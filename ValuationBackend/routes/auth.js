const express = require('express');
const router = express.Router();
const Branch = require('../models/Branch');

// Branch details sent with the signed-in user (null for the Super Admin)
const bankFields = (u) => (u && u.role === 'BANK'
  ? { bankName: u.bankName || '', bankBranch: u.bankBranch || '', designation: u.designation || '', email: u.email || '' } : {});
const branchInfo = async (u) => {
  if (!u?.branchId) return null;
  const b = await Branch.findOne({ id: u.branchId }).select('id code name').lean();
  return b ? { id: b.id, code: b.code, name: b.name } : null;
};
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ 
      username: { $regex: new RegExp(`^${username.trim()}$`, 'i') }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid Username or Password' });
    }

    if (user.status && user.status !== 'Active') {
      return res.status(403).json({ error: 'Account is deactivated. Please contact administrator.' });
    }

    let isMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = (user.password === password);
      if (isMatch) {
        user.password = await bcrypt.hash(password, 10);
        await user.save();
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid Username or Password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone,
        licenseNo: user.licenseNo,
        branch: user.branch,
        branchId: user.branchId || null,
        branchInfo: await branchInfo(user),
        ...bankFields(user),
        status: user.status,
        faceEnrolled: user.faceEnrolled || false,
        faceDescriptor: user.faceDescriptor || [],
        facePhotoUrl: user.facePhotoUrl || ''
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: 'Server error during authentication' });
  }
});

// PUT /api/auth/me/signature  { dataUrl }  — save the engineer's digital signature (PNG / JPG, max 400 KB)
router.put('/me/signature', authenticateToken, async (req, res) => {
  try {
    const dataUrl = String((req.body && req.body.dataUrl) || '');
    if (!/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
      return res.status(400).json({ error: 'The signature must be a PNG or JPG image.' });
    }
    if (dataUrl.length > 550000) return res.status(400).json({ error: 'The signature image is too large (max 400 KB).' });
    const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
    const isPng = bytes.length > 60 && bytes.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
      && bytes.slice(12, 16).toString('latin1') === 'IHDR' && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0;
    const isJpg = bytes.length > 100 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    const isWebp = bytes.length > 30 && bytes.slice(0, 4).toString('latin1') === 'RIFF' && bytes.slice(8, 12).toString('latin1') === 'WEBP';
    if (!isPng && !isJpg && !isWebp) return res.status(400).json({ error: 'This file is not a readable signature image.' });
    await User.updateOne({ id: req.user.id }, { $set: { savedSignature: dataUrl, savedSignatureAt: new Date() } });
    res.json({ success: true, savedSignatureAt: new Date() });
  } catch (err) {
    res.status(500).json({ error: 'Could not save the signature.' });
  }
});

// DELETE /api/auth/me/signature
router.delete('/me/signature', authenticateToken, async (req, res) => {
  await User.updateOne({ id: req.user.id }, { $set: { savedSignature: '' }, $unset: { savedSignatureAt: 1 } });
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      name: req.user.name,
      role: req.user.role,
      phone: req.user.phone,
      licenseNo: req.user.licenseNo,
      branch: req.user.branch,
      branchId: req.user.branchId || null,
      branchInfo: await branchInfo(req.user),
      ...bankFields(req.user),
      status: req.user.status,
      faceEnrolled: req.user.faceEnrolled || false,
      faceDescriptor: req.user.faceDescriptor || [],
      facePhotoUrl: req.user.facePhotoUrl || '',
      savedSignature: req.user.savedSignature || '',
      savedSignatureAt: req.user.savedSignatureAt || null
    }
  });
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

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          phone: user.phone,
          licenseNo: user.licenseNo,
          branch: user.branch,
          branchId: user.branchId || null,
          branchInfo: await branchInfo(user),
        branchId: user.branchId || null,
        branchInfo: await branchInfo(user),
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
