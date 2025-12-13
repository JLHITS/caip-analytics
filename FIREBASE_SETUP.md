# Firebase Setup Guide for National Telephony Stats

## Quick Setup Steps

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "caip-analytics")
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2. Create Firestore Database
1. In your Firebase project, click "Firestore Database" in the left menu
2. Click "Create database"
3. Choose "Start in production mode"
4. Select your region (choose closest to your users)
5. Click "Enable"

### 3. Set Firestore Security Rules
1. Go to "Firestore Database" → "Rules" tab
2. Replace the rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /telephonyStats/global {
      // Allow everyone to read the stats
      allow read: if true;
      // Allow everyone to write (increment counter and update recent list)
      allow write: if true;
    }
  }
}
```

3. Click "Publish"

### 4. Get Firebase Configuration
1. Click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps"
4. Click the web icon (`</>`) to add a web app
5. Register app name (e.g., "CAIP Analytics Web")
6. Copy the `firebaseConfig` object values

### 5. Update Environment Variables
1. Copy `.env.example` to `.env` in your project root
2. Fill in the Firebase configuration values:

```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

3. Also add your existing Gemini API key if not already there

### 6. Initialize the Database (First Run)
The first time someone loads the National Telephony tab:
- Firestore will automatically create the `telephonyStats` collection
- A document called `global` will be created with:
  - `totalChecks: 176` (starting baseline)
  - `recentPractices: []` (empty array)

### 7. Deploy
After setting up Firebase:
1. Commit your changes (don't commit `.env` file!)
2. Make sure `.env` is in your `.gitignore`
3. Add the environment variables to your deployment platform (Vercel/Netlify)
4. Deploy!

## How It Works

- **Global Stats**: All users see the same statistics
- **Real-time Updates**: Stats update across all users instantly
- **Recent Practices**: Shows the 5 most recently viewed practices globally
- **Clickable**: Users can click recent practices to load their data

## Firestore Structure

```
telephonyStats (collection)
  └── global (document)
      ├── totalChecks: number
      └── recentPractices: array
          └── [
              {
                name: "Practice Name",
                odsCode: "ABC123",
                timestamp: "2025-01-13T10:30:00Z"
              }
            ]
```

## Testing Locally

1. Add Firebase credentials to `.env`
2. Run `npm run dev`
3. Navigate to National Telephony tab
4. Select a practice - you should see the counter increment!
5. The stats will persist across page refreshes and be visible to all users

## Troubleshooting

**Error: "Permission denied"**
- Check Firestore security rules are set correctly
- Make sure the rules allow read/write on `telephonyStats/global`

**Stats not showing**
- Check browser console for errors
- Verify all Firebase environment variables are set
- Check Firebase Console to see if the document was created

**Stats not updating**
- Check network tab in browser dev tools
- Verify Firestore rules allow write access
- Check for any JavaScript errors in console
