import * as settingsService from '../services/settingsService';
import * as nicotineService from '../services/nicotineService';

// Update nicotine settings in the Settings UI
export const updateNicotineSettings = async (
  dailyUsageGoal: number,
  dailyFrequencyGoal: number,
  trackingMode: nicotineService.NicotineSettings['trackingMode'],
  defaultDosage: number
) => {
  try {
    await nicotineService.updateNicotineSettings({
      dailyUsageGoal,
      dailyFrequencyGoal,
      trackingMode,
      defaultDosage,
    });
    return true;
  } catch (error) {
    console.error('Error updating nicotine settings:', error);
    return false;
  }
};

// Get current nicotine settings for the Settings UI
export const getNicotineSettings = async (): Promise<nicotineService.NicotineSettings> => {
  try {
    return await nicotineService.getNicotineSettings();
  } catch (error) {
    console.error('Error getting nicotine settings:', error);
    return nicotineService.DEFAULT_NICOTINE_SETTINGS;
  }
}; 