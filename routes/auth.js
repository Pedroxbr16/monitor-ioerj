const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { erro: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.render('login', { erro: 'Email ou senha incorretos.' });
    }
    req.session.user = { id: user._id, name: user.name, email: user.email };
    res.redirect('/dashboard');
  } catch (err) {
    res.render('login', { erro: 'Erro interno. Tente novamente.' });
  }
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register', { erro: null });
});

router.post('/register', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    return res.render('register', { erro: 'As senhas não coincidem.' });
  }
  try {
    const existe = await User.findOne({ email });
    if (existe) return res.render('register', { erro: 'Este email já está cadastrado.' });
    const user = await User.create({ name, email, password });
    req.session.user = { id: user._id, name: user.name, email: user.email };
    res.redirect('/dashboard');
  } catch (err) {
    res.render('register', { erro: 'Erro ao criar conta. Tente novamente.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
});

module.exports = router;
