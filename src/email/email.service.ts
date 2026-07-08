import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
    inviteTemplate,
    debtorNotificationTemplate,
} from './templates/email.templates';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private resend: Resend | null = null;
    private readonly fromAddress: string;
    private readonly frontendUrl: string;

    constructor(private config: ConfigService) {
        const apiKey = this.config.get<string>('RESEND_API_KEY');
        this.fromAddress = this.config.get<string>(
            'EMAIL_FROM',
            'TripControl <onboarding@resend.dev>',
        );
        this.frontendUrl = this.config.get<string>(
            'FRONTEND_URL',
            'http://localhost:3000',
        );

        if (apiKey) {
            this.resend = new Resend(apiKey);
        } else {
            this.logger.warn(
                'RESEND_API_KEY não configurada — e-mails serão apenas logados, não enviados.',
            );
        }
    }

    /**
     * Envio genérico. Se o Resend não estiver configurado, apenas loga
     * (permite rodar em dev sem chave, sem quebrar os fluxos que disparam e-mail).
     */
    private async send(to: string, subject: string, html: string): Promise<boolean> {
        if (!this.resend) {
            this.logger.log(`[e-mail simulado] para: ${to} | assunto: ${subject}`);
            return false;
        }

        try {
            const { error } = await this.resend.emails.send({
                from: this.fromAddress,
                to,
                subject,
                html,
            });

            if (error) {
                this.logger.error(`Falha ao enviar e-mail para ${to}: ${error.message}`);
                return false;
            }
            return true;
        } catch (err) {
            // Nunca deixa a falha de e-mail derrubar a operação principal
            this.logger.error(
                `Erro inesperado ao enviar e-mail para ${to}`,
                err instanceof Error ? err.stack : String(err),
            );
            return false;
        }
    }

    async sendInvite(params: {
        to: string;
        tripName: string;
        inviterName: string;
        inviteToken: string;
    }): Promise<boolean> {
        const inviteUrl = `${this.frontendUrl}/join/${params.inviteToken}`;
        const html = inviteTemplate({
            tripName: params.tripName,
            inviterName: params.inviterName,
            inviteUrl,
        });
        return this.send(
            params.to,
            `${params.inviterName} convidou você para "${params.tripName}"`,
            html,
        );
    }

    async sendDebtorNotification(params: {
        to: string;
        debtorName: string;
        tripName: string;
        amount: string;
        toName: string;
    }): Promise<boolean> {
        const html = debtorNotificationTemplate({
            debtorName: params.debtorName,
            tripName: params.tripName,
            amount: params.amount,
            toName: params.toName,
            appUrl: `${this.frontendUrl}/trips`,
        });
        return this.send(
            params.to,
            `Lembrete de acerto — ${params.tripName}`,
            html,
        );
    }
}
