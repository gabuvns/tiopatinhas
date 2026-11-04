# Ativar login Google e backups

O aplicativo continua funcionando localmente sem Firebase. A integração só é ativada quando as quatro variáveis abaixo existem. Não há credenciais fictícias e nenhum backup é enviado automaticamente.

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/), registre um aplicativo Web e copie a configuração pública. Não use credenciais administrativas no frontend.
2. Em Authentication, habilite o provedor Google. Em Authorized domains, cadastre localhost e gabuvns.github.io (ou o domínio da sua instalação).
3. Crie o Cloud Firestore e publique o conteúdo de [firestore.rules](../firestore.rules) na aba Rules. Não use regras abertas ou apenas “usuário autenticado”: o UID deve coincidir com o caminho do backup.
4. No desenvolvimento, crie .env.local (ignorado pelo Git) com VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID e VITE_FIREBASE_APP_ID. Os valores são a configuração pública do aplicativo Web.
5. No GitHub, crie Repository variables com os mesmos quatro nomes e execute novamente o workflow. O Vite incorpora esses valores públicos ao build. As regras, e não a ocultação da apiKey, controlam o acesso.
6. Teste com duas contas Google distintas: cada uma deve listar apenas seus próprios backups. Confira também login em popup, saída, negação de acesso a outro UID e restauração com prévia. Sem um projeto configurado, esses fluxos reais não podem ser verificados.

## Contrato e limites

Cada backup é um documento imutável em users/{uid}/backups/{id}, com payload JSON validado, SHA-256, eventCount e createdAt definido pelo servidor. A consulta retorna os cinco mais recentes. Atualizações e exclusões remotas estão bloqueadas pelas regras.

O limite cliente é 900.000 bytes para ficar abaixo do limite de documento do Firestore. Backups maiores devem usar exportação JSON local. Leituras e gravações consomem a cota do projeto Firebase; acompanhe o uso no Console.

O login é para os backups remotos. Ele não sincroniza nem troca automaticamente a carteira local. Antes de salvar, a interface exibe a conta de destino. A restauração é validada e confirmada pelo usuário. Sair do Google não apaga o histórico local. Em dispositivo compartilhado, use perfis separados do navegador.

Documentação oficial: [Google Auth](https://firebase.google.com/docs/auth/web/google-signin), [regras do Firestore](https://firebase.google.com/docs/firestore/security/get-started), [limites](https://firebase.google.com/docs/firestore/quotas).
