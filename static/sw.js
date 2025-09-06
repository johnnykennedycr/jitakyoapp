// Este é um Service Worker mínimo, apenas para atender ao critério de instalabilidade do PWA.
// Ele não faz nada, mas sua existência é o que importa para o navegador.
self.addEventListener('fetch', (event) => {
  // Apenas a presença de um listener de 'fetch' já é suficiente.
});