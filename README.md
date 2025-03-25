# Beat The Logbook - Workout and Nutrition Tracker

A comprehensive workout and nutrition tracking app built with React Native and Expo.

## Features

- Track your workouts and progress
- Log your food intake with nutritional information
- View trends and analytics for your fitness journey
- Set goals and monitor your achievements

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Expo CLI

### Installation

1. Clone the repository
   ```
   git clone <repository-url>
   ```

2. Install dependencies
   ```
   cd workout-tracker
   npm install
   ```

3. Set up API credentials
   - The nutrition tracker uses the FatSecret API for food data
   - Register for an account at [FatSecret Platform](https://platform.fatsecret.com/)
   - Create an application to get your Client ID and Client Secret
   - Update the credentials in `services/nutritionService.ts`

4. Start the development server
   ```
   npx expo start
   ```

## Usage

- **Workout Tracker**: Log your exercises, sets, reps, and weights
- **Nutrition Tracker**: Search for foods and log your meals
- **Progress Tracking**: Monitor your progress over time with charts and statistics

## Development

### Project Structure

- `/app`: Main screens and navigation
- `/components`: Reusable UI components
- `/services`: API and business logic services
- `/assets`: Images, fonts, and other static assets

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- FatSecret Platform API for nutrition data
- Expo for the development framework
- React Native for the mobile app foundation
