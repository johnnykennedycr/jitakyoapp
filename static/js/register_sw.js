// Este script verifica se o navegador suporta Service Workers e registra o nosso.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/sw.js')
      .then(registration => {
        console.log('Service Worker registrado com sucesso:', registration);
      })
      .catch(registrationError => {
        console.log('Falha no registro do Service Worker:', registrationError);
      });
  });
}