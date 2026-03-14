const express = require('express');
const router = express.Router();
const User = require('../models/User');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const user = await User.findById(req.session.user.id);
  res.render('profile', { user, sucesso: null, erro: null });
});

router.post('/', async (req, res) => {
  const { name, phone, callmebotApikey, password, confirmPassword } = req.body;
  try {
    const user = await User.findById(req.session.user.id);
    user.name = name.trim();
    user.phone = phone.trim();
    user.callmebotApikey = callmebotApikey.trim();
    if (password) {
      if (password !== confirmPassword) {
        return res.render('profile', { user, sucesso: null, erro: 'As senhas não coincidem.' });
      }
      user.password = password;
    }
    await user.save();
    req.session.user.name = user.name;
    res.render('profile', { user, sucesso: 'Perfil atualizado com sucesso!', erro: null });
  } catch (err) {
    const user = await User.findById(req.session.user.id);
    res.render('profile', { user, sucesso: null, erro: 'Erro ao salvar. Tente novamente.' });
  }
});

module.exports = router;
