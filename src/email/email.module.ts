import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Módulo global — o EmailService fica disponível para qualquer módulo
 * sem precisar importar EmailModule em cada um.
 */
@Global()
@Module({
    providers: [EmailService],
    exports: [EmailService],
})
export class EmailModule { }
