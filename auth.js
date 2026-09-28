const requireAuth = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

const allowRoles = (...roles) => (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  if (!roles.includes(req.session.user.role)) {
    return res.status(403).render('error', {
      title: 'Akses ditolak',
      code: 403,
      message: 'Akun Anda tidak memiliki izin untuk membuka halaman ini.'
    });
  }
  next();
};

const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

module.exports = { requireAuth, allowRoles, asyncHandler };