// Who can see what:
//   SUPER_ADMIN → everything (optionally narrowed to one branch with the x-branch-scope header)
//   ADMIN       → only their own branch (cases, staff, attendance, live map, alerts)
//   ENGINEER    → only their own cases and records
const isSuper = (u) => u?.role === 'SUPER_ADMIN';
const isBranchAdmin = (u) => u?.role === 'ADMIN';
const isAdmin = (u) => isSuper(u) || isBranchAdmin(u);
const isBank = (u) => u?.role === 'BANK';

// The branch a request is limited to, or null for "all branches"
function branchScope(req) {
  const u = req.user;
  if (isBranchAdmin(u) || u?.role === 'ENGINEER' || isBank(u)) return u.branchId || '__none__';
  const pick = req.headers['x-branch-scope'] || req.query.branchId;
  return pick && pick !== 'all' ? String(pick) : null;
}

// Mongo filter for cases visible to this request
function caseFilter(req) {
  const u = req.user;
  if (u?.role === 'ENGINEER') return { $or: [{ assignedEngineerId: u.id }, { assignedEngineerId: u.username }] };
  if (isBank(u)) return { 'requestedBy.id': u.id };   // a bank employee sees only their own requests
  const b = branchScope(req);
  return b ? { branchId: b } : {};
}

function canSeeCase(user, c) {
  if (!user || !c) return false;
  if (isSuper(user)) return true;
  if (isBranchAdmin(user)) return !!user.branchId && c.branchId === user.branchId;
  if (isBank(user)) return !!c.requestedBy && c.requestedBy.id === user.id;
  if (user.role !== 'ENGINEER') return false;
  return c.assignedEngineerId === user.id || c.assignedEngineerId === user.username;
}

// Mongo filter for people visible to this request
function userFilter(req) {
  const u = req.user;
  if (u?.role === 'ENGINEER') return { $or: [{ id: u.id }, { role: 'ADMIN', branchId: u.branchId || '__none__' }] };
  if (isBank(u)) return { id: u.id };
  const b = branchScope(req);
  return b ? { branchId: b } : {};
}

// May `actor` manage (edit, reset password, delete) account `target`?
function canManageUser(actor, target) {
  if (!actor || !target) return false;
  if (isSuper(actor)) return true;
  return isBranchAdmin(actor) && ['ENGINEER', 'BANK'].includes(target.role) && !!actor.branchId && target.branchId === actor.branchId;
}

module.exports = { isSuper, isBranchAdmin, isAdmin, isBank, branchScope, caseFilter, canSeeCase, userFilter, canManageUser };
