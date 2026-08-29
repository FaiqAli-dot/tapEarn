export const QUEST_DEFS = [
  {
    id: 'quest_easy',
    difficulty: 'easy',
    isPrimary: true,
    questType: 'CLICK_COUNT',
    requiredAmount: 100,
    title: 'Tap Master',
    description: 'Tap 100 times today',
    ypReward: 250,
    xpReward: 25
  },
  {
    id: 'quest_medium',
    difficulty: 'medium',
    isPrimary: true,
    questType: 'CAMPAIGN_COMPLETION',
    requiredAmount: 1,
    title: 'Campaign Runner',
    description: 'Complete 1 campaign today',
    ypReward: 500,
    xpReward: 50
  },
  {
    id: 'quest_hard',
    difficulty: 'hard',
    isPrimary: true,
    questType: 'POINT_EARNINGS',
    requiredAmount: 2500,
    title: 'Big Earner',
    description: 'Earn 2,500 YP today',
    ypReward: 750,
    xpReward: 75
  },
  {
    id: 'quest_bonus',
    difficulty: 'bonus',
    isPrimary: false,
    questType: 'REFERRAL_SUCCESS',
    requiredAmount: 1,
    title: 'Refer a Friend',
    description: 'Get a successful referral today (optional)',
    ypReward: 2500,
    xpReward: 150
  }
];

export const ALL_PRIMARY_BONUS = { ypReward: 1500, xpReward: 100 };

export function generateDailyQuests() {
  return QUEST_DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    description: def.description,
    questType: def.questType,
    difficulty: def.difficulty,
    isPrimary: def.isPrimary,
    requiredAmount: def.requiredAmount,
    currentProgress: 0,
    ypReward: def.ypReward,
    xpReward: def.xpReward,
    points: def.ypReward,
    completed: false,
    completedAt: null,
    type: 'custom'
  }));
}
