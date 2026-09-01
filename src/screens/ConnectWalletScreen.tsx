import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTonConnectUI, useTonAddress, useTonWallet, CHAIN } from '@tonconnect/ui-react'
import { useTelegram } from '../hooks/useTelegram'
import { GameState } from '../types/game'
import { apiService } from '../services/api'
import { tonExplorerAddressUrl, tonExplorerTxUrl } from '../config/ton'
import {
  Wallet,
  Copy,
  Check,
  ExternalLink,
  Shield,
  TrendingUp,
  AlertCircle,
  Loader2,
  BadgeCheck,
} from 'lucide-react'

interface ConnectWalletScreenProps {
  gameState: GameState
  onSetWalletConnection: (connected: boolean, address?: string) => void
}

type PaymentRecord = {
  id: string
  status: string
  grossAmountNanoton?: string
  executionReserveNanoton?: string
  outgoingFeesNanoton?: string
  netAmountNanoton?: string
  referrerShareNanoton?: string
  treasuryShareNanoton?: string
  contractAddress?: string | null
  contractPayloadBoc?: string | null
  inboundTxHash?: string | null
  referrerPayoutTxHash?: string | null
  treasuryPayoutTxHash?: string | null
  authorizationPayload?: Record<string, unknown>
  economicRule?: string
  estimatedFeesNote?: string
  explorerUrls?: {
    inbound?: string | null
    referrerPayout?: string | null
    treasuryPayout?: string | null
  }
}

const ConnectWalletScreen: React.FC<ConnectWalletScreenProps> = ({
  gameState,
  onSetWalletConnection,
}) => {
  const [tonConnectUI] = useTonConnectUI()
  const address = useTonAddress(true)
  const wallet = useTonWallet()
  const { hapticFeedback, showAlert, showConfirm } = useTelegram()
  const [isConnecting, setIsConnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [walletVerified, setWalletVerified] = useState(Boolean(gameState.walletVerified))
  const [isVerifying, setIsVerifying] = useState(false)
  const [quote, setQuote] = useState<any>(null)
  const [activePayment, setActivePayment] = useState<PaymentRecord | null>(null)
  const [paymentBusy, setPaymentBusy] = useState(false)

  const connected = !!address && !!wallet

  useEffect(() => {
    if (connected && address) {
      onSetWalletConnection(true, address)
    } else {
      onSetWalletConnection(false)
      setWalletVerified(false)
    }
  }, [connected, address, onSetWalletConnection])

  useEffect(() => {
    setWalletVerified(Boolean(gameState.walletVerified))
  }, [gameState.walletVerified])

  useEffect(() => {
    apiService
      .getPaymentQuote()
      .then((res) => setQuote(res.data))
      .catch(() => {
        /* quote unavailable until backend TON env is configured */
      })
  }, [])

  const handleConnect = async () => {
    try {
      setIsConnecting(true)
      tonConnectUI.setConnectRequestParameters({
        state: 'ready',
        value: { tonProof: '<placeholder>' },
      })
      await tonConnectUI.connectWallet()
      hapticFeedback('light')
    } catch (error) {
      console.error('Connection failed:', error)
      showAlert('Failed to connect wallet. Please try again.')
    } finally {
      setIsConnecting(false)
      tonConnectUI.setConnectRequestParameters(null)
    }
  }

  const handleVerifyWallet = useCallback(async () => {
    if (!wallet?.account) {
      showAlert('Connect a wallet first.')
      return
    }

    try {
      setIsVerifying(true)
      const challenge = await apiService.getTonProofChallenge()
      const nonce = challenge.data.nonce

      tonConnectUI.setConnectRequestParameters({
        state: 'ready',
        value: { tonProof: nonce },
      })

      const reconnect = await tonConnectUI.connectWallet()
      const tonProof = reconnect?.connectItems?.tonProof
      if (!tonProof || tonProof.name !== 'ton_proof') {
        throw new Error('Wallet did not return ton_proof')
      }
      if ('error' in tonProof) {
        throw new Error(tonProof.error.message || 'ton_proof rejected')
      }

      if (!wallet.account.publicKey) {
        throw new Error('Wallet public key unavailable')
      }

      const result = await apiService.verifyTonProof({
        address: wallet.account.address,
        publicKey: wallet.account.publicKey,
        proof: tonProof.proof as any,
      })

      setWalletVerified(true)
      hapticFeedback('light')
      showAlert(`Wallet verified (testnet): ${result.data.walletAddress.slice(0, 8)}…`)
    } catch (error: any) {
      console.error('Verify failed:', error)
      showAlert(error?.message || 'Wallet verification failed')
    } finally {
      setIsVerifying(false)
      tonConnectUI.setConnectRequestParameters(null)
    }
  }, [wallet, tonConnectUI, hapticFeedback, showAlert])

  const handleDisconnect = async () => {
    const confirmed = await showConfirm('Disconnect your testnet wallet?')
    if (!confirmed) return
    try {
      await tonConnectUI.disconnect()
      setWalletVerified(false)
      setActivePayment(null)
      hapticFeedback('light')
    } catch {
      showAlert('Failed to disconnect wallet.')
    }
  }

  const copyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      hapticFeedback('light')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const handleSubscribe = async () => {
    if (!walletVerified) {
      showAlert('Verify your wallet before subscribing.')
      return
    }

    try {
      setPaymentBusy(true)
      const intent = await apiService.createPaymentIntent()
      const payment = intent.payment as PaymentRecord
      setActivePayment(payment)

      const dest = payment.contractAddress
      if (!dest) {
        throw new Error('Contract address not configured on server')
      }

      const amount = payment.grossAmountNanoton || quote?.grossAmountNanoton
      if (!amount) throw new Error('Missing subscription amount from server')

      const payload = payment.contractPayloadBoc
      if (!payload) {
        throw new Error('Missing signed contract payload from server')
      }

      const tx = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        network: CHAIN.TESTNET,
        messages: [
          {
            address: dest,
            amount,
            payload,
          },
        ],
      })

      const inboundHash = tx.boc
      const submit = await apiService.submitPaymentTx(payment.id, inboundHash)
      setActivePayment(submit.payment)
      hapticFeedback('light')
      showAlert('Payment submitted — verifying on testnet…')
    } catch (error: any) {
      console.error('Subscribe failed:', error)
      showAlert(error?.message || 'Subscription payment failed')
    } finally {
      setPaymentBusy(false)
    }
  }

  const formatTon = (nanoton?: string | null) => {
    if (!nanoton) return '—'
    return `${(Number(nanoton) / 1e9).toFixed(4)} TON`
  }

  const walletFeatures = [
    {
      title: 'Testnet Subscription',
      description: 'Pay TON on testnet to activate referral revenue share (not YP)',
      icon: TrendingUp,
      color: 'from-blue-500 to-indigo-500',
    },
    {
      title: 'Verify Wallet Ownership',
      description: 'Cryptographic ton_proof — required before payouts',
      icon: BadgeCheck,
      color: 'from-purple-500 to-violet-500',
    },
    {
      title: 'Secure & Non-custodial',
      description: 'Server never holds keys; splits enforced after on-chain fees',
      icon: Shield,
      color: 'from-green-500 to-emerald-500',
    },
  ]

  return (
    <div className="min-h-screen p-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">TON Testnet Wallet</h1>
        <p className="text-gray-600">Connect, verify, and pay testnet subscription (YORZA V2)</p>
        <p className="text-xs text-amber-700 mt-2 bg-amber-50 inline-block px-3 py-1 rounded-full">
          TESTNET ONLY — not real money · MAINNET NOT DEPLOYED
        </p>
      </div>

      <div className="tg-card p-6 mb-6">
        <div className="text-center">
          <div
            className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
              connected ? 'bg-green-100' : 'bg-gray-100'
            }`}
          >
            <Wallet className={`w-10 h-10 ${connected ? 'text-green-600' : 'text-gray-600'}`} />
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {connected ? 'Wallet Connected' : 'Wallet Not Connected'}
          </h2>

          {!connected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="tg-button w-full max-w-xs disabled:opacity-50"
            >
              {isConnecting ? 'Connecting…' : 'Connect TON Wallet (Testnet)'}
            </button>
          ) : (
            <div className="space-y-2 max-w-xs mx-auto">
              <button onClick={handleDisconnect} className="tg-button-secondary w-full">
                Disconnect
              </button>
              {!walletVerified && (
                <button
                  onClick={handleVerifyWallet}
                  disabled={isVerifying}
                  className="tg-button w-full disabled:opacity-50"
                >
                  {isVerifying ? 'Verifying…' : 'Verify Wallet (ton_proof)'}
                </button>
              )}
              {walletVerified && (
                <p className="text-sm text-green-700 flex items-center justify-center gap-1">
                  <BadgeCheck className="w-4 h-4" /> Verified testnet wallet
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {connected && address && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="tg-card p-4 mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Wallet Information</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Address</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-mono text-gray-800">
                  {address.slice(0, 8)}…{address.slice(-8)}
                </span>
                <button onClick={copyAddress} className="p-1 text-gray-500">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Network</span>
              <span className="text-sm font-medium text-amber-700">TON Testnet</span>
            </div>
            <button
              onClick={() => window.open(tonExplorerAddressUrl(address), '_blank')}
              className="w-full p-3 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center space-x-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>View on testnet.tonscan.org</span>
            </button>
          </div>
        </motion.div>
      )}

      {quote && (
        <div className="tg-card p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Testnet Subscription</h3>
          <p className="text-xs text-gray-500 mb-3">{quote.economicRule}</p>
          <div className="grid grid-cols-2 gap-2 text-sm mb-4">
            <div className="p-2 bg-gray-50 rounded">
              <div className="text-gray-500 text-xs">Gross (testnet)</div>
              <div className="font-semibold">{quote.grossAmountTon} TON</div>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <div className="text-gray-500 text-xs">Est. execution reserve</div>
              <div className="font-semibold">{quote.executionReserveTon} TON</div>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <div className="text-gray-500 text-xs">Est. forward fees (2×)</div>
              <div className="font-semibold">{quote.outgoingFeesTon} TON</div>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <div className="text-gray-500 text-xs">Est. net</div>
              <div className="font-semibold">{quote.estimatedNetTon} TON</div>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <div className="text-gray-500 text-xs">Referrer share (50% net)</div>
              <div className="font-semibold">{formatTon(quote.estimatedReferrerShareNanoton)}</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">{quote.feePolicy}</p>
          <button
            onClick={handleSubscribe}
            disabled={!walletVerified || paymentBusy}
            className="tg-button w-full disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {paymentBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Processing…
              </>
            ) : (
              'Pay Testnet Subscription'
            )}
          </button>
        </div>
      )}

      {activePayment && (
        <div className="tg-card p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Payment Status</h3>
          <div className="text-sm space-y-2">
            <p>
              Status: <span className="font-medium">{activePayment.status}</span>
            </p>
            <p>Gross: {formatTon(activePayment.grossAmountNanoton)}</p>
            <p>Execution reserve (est.): {formatTon(activePayment.executionReserveNanoton)}</p>
            <p>Forward fees (est.): {formatTon(activePayment.outgoingFeesNanoton)}</p>
            <p>Net (distributable est.): {formatTon(activePayment.netAmountNanoton)}</p>
            <p>Referrer payout (50% net): {formatTon(activePayment.referrerShareNanoton)}</p>
            <p>Treasury share: {formatTon(activePayment.treasuryShareNanoton)}</p>
            {activePayment.status === 'PARTIALLY_SETTLED' && (
              <p className="text-amber-700 text-xs">
                Partially settled — not all outbound payouts confirmed on-chain yet.
              </p>
            )}
            {activePayment.inboundTxHash && (
              <button
                className="text-blue-600 text-xs underline"
                onClick={() =>
                  window.open(
                    activePayment.explorerUrls?.inbound ||
                      tonExplorerTxUrl(activePayment.inboundTxHash!),
                    '_blank'
                  )
                }
              >
                Inbound tx explorer
              </button>
            )}
          </div>
        </div>
      )}

      <div className="tg-card p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Wallet Features</h3>
        <div className="space-y-3">
          {walletFeatures.map((feature, index) => {
            const IconComponent = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                <div
                  className={`w-10 h-10 bg-gradient-to-r ${feature.color} rounded-full flex items-center justify-center`}
                >
                  <IconComponent className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{feature.title}</h4>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-800 mb-1">Testnet Security</h4>
            <p className="text-sm text-blue-700">
              YP (points) stay off-chain. TON subscription payouts are testnet-only. We never store
              your seed phrase. Amounts, splits, and destinations are chosen by the server — not the
              client.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConnectWalletScreen
