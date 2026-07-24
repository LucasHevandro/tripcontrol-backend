/** Estilo inline obrigatório: clientes de e-mail ignoram <style> externo. */

const BRAND = '#1f9d6f';
const TEXT = '#171717';
const MUTED = '#737373';
const BORDER = '#e5e5e5';

function layout(content: string): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0; padding:0; background-color:#f7f6f1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f6f1; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border:1px solid ${BORDER}; border-radius:12px; overflow:hidden;">
                    <tr>
                        <td style="padding: 24px 32px; border-bottom:1px solid ${BORDER};">
                            <span style="font-size:18px; font-weight:600; color:${TEXT};">✈️ TripControl</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px;">
                            ${content}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 16px 32px; border-top:1px solid ${BORDER};">
                            <p style="margin:0; font-size:12px; color:${MUTED};">
                                Este é um e-mail automático do TripControl. Se você não esperava recebê-lo, pode ignorá-lo com segurança.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`.trim();
}

function button(label: string, href: string): string {
    return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
    <tr>
        <td style="border-radius:8px; background-color:${BRAND};">
            <a href="${href}" target="_blank"
               style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
                ${label}
            </a>
        </td>
    </tr>
</table>`.trim();
}

export function inviteTemplate(params: {
    tripName: string;
    inviterName: string;
    inviteUrl: string;
}): string {
    const content = `
        <h1 style="margin:0 0 8px; font-size:20px; color:${TEXT};">Você foi convidado para uma viagem!</h1>
        <p style="margin:0 0 16px; font-size:15px; line-height:1.5; color:${MUTED};">
            <strong style="color:${TEXT};">${params.inviterName}</strong> convidou você para participar da viagem
            <strong style="color:${TEXT};">${params.tripName}</strong> no TripControl.
        </p>
        <p style="margin:0; font-size:15px; line-height:1.5; color:${MUTED};">
            Clique no botão abaixo para entrar e começar a planejar juntos — despesas, roteiro e reservas em um só lugar.
        </p>
        ${button('Entrar na viagem', params.inviteUrl)}
        <p style="margin:0; font-size:13px; color:${MUTED};">
            Ou copie e cole este link no navegador:<br />
            <a href="${params.inviteUrl}" style="color:${BRAND}; word-break:break-all;">${params.inviteUrl}</a>
        </p>
    `;
    return layout(content);
}

export function debtorNotificationTemplate(params: {
    debtorName: string;
    tripName: string;
    amount: string;
    toName: string;
    appUrl: string;
}): string {
    const content = `
        <h1 style="margin:0 0 8px; font-size:20px; color:${TEXT};">Lembrete de acerto 💸</h1>
        <p style="margin:0 0 16px; font-size:15px; line-height:1.5; color:${MUTED};">
            Olá, <strong style="color:${TEXT};">${params.debtorName}</strong>! Este é um lembrete de que você tem um
            acerto pendente na viagem <strong style="color:${TEXT};">${params.tripName}</strong>.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0; background-color:#f7f6f1; border-radius:8px;">
            <tr>
                <td style="padding: 16px 20px;">
                    <p style="margin:0; font-size:14px; color:${MUTED};">Valor a pagar para ${params.toName}</p>
                    <p style="margin:4px 0 0; font-size:24px; font-weight:700; color:${BRAND};">${params.amount}</p>
                </td>
            </tr>
        </table>
        <p style="margin:0; font-size:15px; line-height:1.5; color:${MUTED};">
            Acesse o TripControl para ver os detalhes e combinar o pagamento com o grupo.
        </p>
        ${button('Ver acertos', params.appUrl)}
    `;
    return layout(content);
}
