// Função para converter a chave pública VAPID
console.log("✅ Arquivo notifications.js carregado com sucesso!");
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Função principal para se inscrever para notificações push
async function subscribeUserToPush() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            console.log('Usuário já inscrito para notificações push.');
            return;
        }

        
        const vapidPublicKey = window.VAPID_PUBLIC_KEY;
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

        const newSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

        console.log('Nova inscrição para push:', newSubscription);

        // Envia a inscrição para o seu backend para ser salva
        await fetch('/aluno/save-push-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newSubscription),
        });

        console.log('Inscrição enviada para o backend com sucesso.');

    } catch (error) {
        console.error('Falha ao se inscrever para notificações push:', error);
    }
}

// Pergunta ao usuário se ele quer receber notificações
function askForNotificationPermission() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        console.warn('Este navegador não suporta notificações push.');
        return;
    }

    Notification.requestPermission(status => {
        console.log('Status da permissão de notificação:', status);
        if (status === 'granted') {
            // Se o usuário permitir, nós o inscrevemos
            subscribeUserToPush();
        }
    });
}

// Podemos chamar a função para pedir permissão assim que a página da área do aluno carregar.
// Por exemplo, podemos adicionar um botão "Ativar Notificações".