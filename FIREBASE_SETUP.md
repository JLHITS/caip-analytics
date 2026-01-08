# Firebase Firestore Security Rules Setup

To enable the Firebase share link feature, you need to update the Firestore security rules in the Firebase Console.

## Steps

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Rules**
4. Replace the existing rules with the following:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Existing rules for other collections
    // ...your existing rules here...

    // Rules for shared dashboards
    match /sharedDashboards/{shareId} {
      // Allow anyone to create a new share (no authentication required)
      allow create: if request.auth == null
                    && request.resource.data.keys().hasAll(['data', 'type', 'createdAt', 'expiresAt', 'version'])
                    && request.resource.data.type in ['demand-capacity', 'triage-slots'];

      // Allow anyone to read shares (for viewing shared dashboards)
      allow read: if true;

      // No updates or deletes allowed (shares are immutable)
      allow update, delete: if false;
    }
  }
}
```

5. Click **Publish** to save the rules

## What These Rules Do

- **Create**: Allows anyone to create a share link without authentication, but validates the required fields
- **Read**: Allows anyone with the share ID to view the dashboard
- **Update/Delete**: Prevents modification or deletion of shares (they expire automatically after 30 days)

## Testing

After updating the rules, try generating a share link in the app. The "Missing or insufficient permissions" error should be resolved.
