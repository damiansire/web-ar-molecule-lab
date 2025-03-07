# Gold Rules

## app.js and Application State

In app.js, there is a variable called `appState`.

This variable represents the application's state.

The only way to interact with it from outside the object should be through events handled in `handleAppStateChanged`.

This is the way to control the rendering and how the application behaves at a general level."
