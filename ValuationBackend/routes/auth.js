const express = require('express');
const router = express.Router();
const User = require('../models/User');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ 
      username: { $regex: new RegExp(`^${username.trim()}$`, 'i') },
      password: password 
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid Username or Password' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone,
        licenseNo: user.licenseNo,
        branch: user.branch,
        status: user.status
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: 'Server error during authentication' });
  }
});

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

// WebAuthn Config
const rpName = process.env.WEBAUTHN_RP_NAME || 'GCR Valuations App';
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN || `http://${rpID}:5173`;

// 1. Generate Registration Options (Logged in user registering their device)
router.post('/webauthn/register-options', async (req, res) => {
  const { userId } = req.body;
  const user = await User.findOne({ id: userId });
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const userPasskeys = user.credentials || [];

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: Buffer.from(user.id),
    userName: user.username,
    // Require discoverable credentials (Passkeys)
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
    excludeCredentials: userPasskeys.map(passkey => ({
      id: Buffer.from(passkey.credentialID, 'base64'),
      transports: passkey.transports,
    })),
  });

  user.currentChallenge = options.challenge;
  await user.save();

  res.json(options);
});

// 2. Verify Registration Response
router.post('/webauthn/register-verify', async (req, res) => {
  const { userId, response } = req.body;
  const user = await User.findOne({ id: userId });

  if (!user || !user.currentChallenge) {
    return res.status(400).json({ error: 'User or challenge not found' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (verification.verified && verification.registrationInfo) {
      // Support both v9 and v10+ schemas of SimpleWebAuthn
      const cred = verification.registrationInfo.credential || verification.registrationInfo;
      const { id, publicKey, counter } = cred;
      
      const credentialID = cred.credentialID || id;
      const credentialPublicKey = cred.credentialPublicKey || publicKey;

      if (!user.credentials) user.credentials = [];
      
      user.credentials.push({
        credentialID: Buffer.from(credentialID).toString('base64'),
        credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64'),
        counter: cred.counter || counter,
        transports: response.response.transports || [],
      });

      user.currentChallenge = '';
      await user.save();

      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Verification failed' });
    }
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// 3. Generate Authentication Options (For Login)
router.post('/webauthn/login-options', async (req, res) => {
  // Passkeys support passwordless without knowing username first
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
  });

  // Since we don't know the user yet, we could save the challenge to a session or a temp collection
  // For simplicity in a stateless API without sessions, we will send it to the client to send back
  // Warning: In production, store this server-side tied to a session ID!
  res.json(options);
});

// 4. Verify Authentication Response
router.post('/webauthn/login-verify', async (req, res) => {
  const { response, expectedChallenge } = req.body;
  
  // Find the user who owns this credential
  const credentialIDBase64 = response.id;
  
  const user = await User.findOne({
    'credentials.credentialID': credentialIDBase64
  });

  if (!user) {
    return res.status(404).json({ error: 'Device not registered to any user' });
  }

  const passkey = user.credentials.find(c => c.credentialID === credentialIDBase64);

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(passkey.credentialID, 'base64'),
        credentialPublicKey: Buffer.from(passkey.credentialPublicKey, 'base64'),
        counter: passkey.counter,
      },
    });

    if (verification.verified && verification.authenticationInfo) {
      passkey.counter = verification.authenticationInfo.newCounter;
      await user.save();

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          phone: user.phone,
          licenseNo: user.licenseNo,
          branch: user.branch,
          status: user.status
        }
      });
    } else {
      res.status(400).json({ error: 'Authentication failed' });
    }
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
