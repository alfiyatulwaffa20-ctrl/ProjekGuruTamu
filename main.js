document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-demo-user]').forEach((button) => {
    button.addEventListener('click', () => {
      const username = document.querySelector('input[name="username"]');
      const password = document.querySelector('input[name="password"]');
      if (!username || !password) return;
      username.value = button.dataset.demoUser;
      password.value = 'password123';
      password.focus();
    });
  });
});
