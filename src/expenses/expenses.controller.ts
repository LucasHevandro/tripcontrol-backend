import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Post as HttpPost,
  Query as QueryParam,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CreatePaymentDto } from './dto/create-payment-dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('trips/:tripId/expenses')
export class ExpensesController {
  constructor(private expensesService: ExpensesService) { }

  @Get()
  @ApiOperation({ summary: 'Listar despesas da viagem' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @QueryParam('category') category?: string,
    @QueryParam('page') page?: number,
    @QueryParam('limit') limit?: number,
  ) {
    return this.expensesService.findAll(user.id, tripId, category, page, limit);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumo financeiro por categoria' })
  getSummary(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
  ) {
    return this.expensesService.getSummary(user.id, tripId);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar nova despesa com divisão' })
  create(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(user.id, tripId, dto);
  }

  @Patch(':expenseId')
  @ApiOperation({ summary: 'Editar despesa' })
  update(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @Param('expenseId') expenseId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(user.id, tripId, expenseId, dto);
  }

  @Delete(':expenseId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deletar despesa' })
  remove(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @Param('expenseId') expenseId: string,
  ) {
    return this.expensesService.remove(user.id, tripId, expenseId);
  }
  @Post(':expenseId/receipt')
  @ApiOperation({ summary: 'Upload de comprovante da despesa' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/receipts',
        filename: (_, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `receipt-${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadReceipt(
    @CurrentUser() user: { id: string },
    @Param('tripId') tripId: string,
    @Param('expenseId') expenseId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.expensesService.uploadReceipt(user.id, tripId, expenseId, file);
  }
}

@Controller('trips/:tripId/payments')
@UseGuards(JwtGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: ExpensesService) { }

  @Post()
  async create(
    @Param('tripId') tripId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(tripId, user.id, dto);
  }

  @Get()
  async findAll(
    @Param('tripId') tripId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.paymentsService.findAllPayments(tripId, user.id);
  }

  @Delete(':paymentId')
  @HttpCode(204)
  async remove(
    @Param('tripId') tripId: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.paymentsService.deletePayment(tripId, paymentId, user.id);
  }
}
