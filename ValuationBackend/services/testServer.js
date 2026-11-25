// On the staging (test) server nothing leaves the building: no emails to banks or customers, no phone pushes,
// no WhatsApp. Real banks must never get a practice report or invoice. (Override only on purpose:
// ALLOW_OUTGOING_ON_STAGING=true.) The live server runs with NODE_ENV=production and is not affected.
const isStaging = () => String(process.env.NODE_ENV || '').trim().toLowerCase() === 'staging';
const outgoingBlocked = () => isStaging() && String(process.env.ALLOW_OUTGOING_ON_STAGING || '').toLowerCase() !== 'true';
module.exports = { isStaging, outgoingBlocked };
