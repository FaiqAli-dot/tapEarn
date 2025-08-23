import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTonConnectUI, useTonAddress, useTonWallet } from '@tonconnect/ui-react'
import { useTelegram } from '../hooks/useTelegram'
import { GameState } from '../types/game'
import { 
  Wallet, 
  Copy, 
  Check, 
  ExternalLink, 
  Shield, 
  Coins,
  TrendingUp,
  AlertCircle
} from 'lucide-react'

interface ConnectWalletScreenProps {
  gameState: GameState
  onSetWalletConnection: (connected: boolean, address?: string) => void
}

const ConnectWalletScreen: React.FC<ConnectWalletScreenProps> = ({ gameState, onSetWalletConnection }) => {
  const [tonConnectUI] = useTonConnectUI()
  const address = useTonAddress()
  const wallet = useTonWallet()
  const { hapticFeedback, showAlert, showConfirm } = useTelegram()
  const [isConnecting, setIsConnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  const connected = !!address && !!wallet

  useEffect(() => {
    if (connected && address) {
      onSetWalletConnection(true, address)
    } else {
      onSetWalletConnection(false)
    }
  }, [connected, address, onSetWalletConnection])

  const handleConnect = async () => {
    try {
      setIsConnecting(true)
      await tonConnectUI.connectWallet()
      hapticFeedback('light')
    } catch (error) {
      console.error('Connection failed:', error)
      showAlert('Failed to connect wallet. Please try again.')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    const confirmed = await showConfirm('Are you sure you want to disconnect your wallet?')
    if (confirmed) {
      try {
        await tonConnectUI.disconnect()
        hapticFeedback('light')
        showAlert('Wallet disconnected successfully')
      } catch (error) {
        console.error('Disconnect failed:', error)
        showAlert('Failed to disconnect wallet. Please try again.')
      }
    }
  }

  const copyAddress = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address)
        setCopied(true)
        hapticFeedback('light')
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Failed to copy:', error)
      }
    }
  }

  const openExplorer = () => {
    if (address) {
      window.open(`https://tonscan.org/address/${address}`, '_blank')
    }
  }

  const walletFeatures = [
    {
      title: 'Claim Points as Tokens',
      description: 'Convert your earned points to TON Jettons',
      icon: Coins,
      color: 'from-yellow-500 to-orange-500'
    },
    {
      title: 'Premium Upgrades',
      description: 'Purchase upgrades using TON tokens',
      icon: TrendingUp,
      color: 'from-blue-500 to-indigo-500'
    },
    {
      title: 'Secure Transactions',
      description: 'All blockchain operations are secure and transparent',
      icon: Shield,
      color: 'from-green-500 to-emerald-500'
    }
  ]

  const tonStats = {
    network: 'Mainnet',
    blockHeight: '12,345,678',
    gasPrice: '0.05 TON',
    totalSupply: '5,000,000,000 TON'
  }

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Connect TON Wallet</h1>
        <p className="text-gray-600">Connect your wallet to unlock premium features</p>
      </div>

      {/* Connection Status */}
      <div className="tg-card p-6 mb-6">
        <div className="text-center">
          <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
            connected ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            <Wallet className={`w-10 h-10 ${connected ? 'text-green-600' : 'text-gray-600'}`} />
          </div>
          
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {connected ? 'Wallet Connected' : 'Wallet Not Connected'}
          </h2>
          
          <p className="text-gray-600 mb-4">
            {connected 
              ? 'Your TON wallet is connected and ready to use'
              : 'Connect your TON wallet to access premium features'
            }
          </p>

          {!connected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="tg-button w-full max-w-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? 'Connecting...' : 'Connect TON Wallet'}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="tg-button-secondary w-full max-w-xs"
            >
              Disconnect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Wallet Info */}
      {connected && address && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="tg-card p-4 mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Wallet Information</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Address:</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-mono text-gray-800">
                  {address.slice(0, 8)}...{address.slice(-8)}
                </span>
                <button
                  onClick={copyAddress}
                  className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Network:</span>
              <span className="text-sm font-medium text-gray-800">{tonStats.network}</span>
            </div>

            <button
              onClick={openExplorer}
              className="w-full p-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center space-x-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>View on TON Explorer</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Wallet Features */}
      <div className="tg-card p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Premium Features</h3>
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
                <div className={`w-10 h-10 bg-gradient-to-r ${feature.color} rounded-full flex items-center justify-center`}>
                  <IconComponent className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{feature.title}</h4>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </div>
                {!connected && (
                  <div className="text-xs text-gray-400 bg-gray-200 px-2 py-1 rounded">
                    Locked
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* TON Network Stats */}
      <div className="tg-card p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">TON Network Status</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <div className="text-lg font-bold text-blue-600">{tonStats.blockHeight}</div>
            <div className="text-xs text-gray-500">Block Height</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <div className="text-lg font-bold text-green-600">{tonStats.gasPrice}</div>
            <div className="text-xs text-gray-500">Gas Price</div>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-800 mb-1">Security Notice</h4>
            <p className="text-sm text-blue-700">
              Your wallet connection is secure and encrypted. We never store your private keys or seed phrases. 
              Always verify transaction details before confirming.
            </p>
          </div>
        </div>
      </div>

      {/* Connection Instructions */}
      {!connected && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 text-center text-sm text-gray-500"
        >
          <p>Don't have a TON wallet?</p>
          <button
            onClick={() => window.open('https://ton.org/wallets', '_blank')}
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Get one here
          </button>
        </motion.div>
      )}
    </div>
  )
}

export default ConnectWalletScreen
