import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TripsService } from '../trips/trips.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import {
  ReservationCategory,
  ReservationStatus,
} from '../generated/prisma/enums';
import type { ReservationModel } from '../generated/prisma/models';

// Campos específicos por categoria, armazenados soltos no Json `details` —
// nenhuma categoria usa todos, cada uma lê só os campos que lhe interessam.
export interface ReservationDetails {
  checkIn?: string;
  checkOut?: string;
  guestCount?: string | number;
  roomCount?: string | number;
  address?: string;
  reservationCode?: string;
  departureDate?: string;
  flightNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
  returnDate?: string;
  returnFlightNumber?: string;
  returnTime?: string;
  passengerCount?: string | number;
  cabinClass?: string;
  locator?: string;
  pickupDate?: string;
  pickupTime?: string;
  pickupLocation?: string;
  carModel?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  peopleCount?: string | number;
  meetingPoint?: string;
  amountSublabel?: string;
  warning?: string;
}

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private tripsService: TripsService,
  ) {}

  // ─── Listar reservas ──────────────────────────────────────────────────────

  async findAll(
    userId: string,
    tripId: string,
    category?: ReservationCategory,
  ) {
    await this.tripsService.assertParticipant(userId, tripId);

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { name: true, startDate: true, endDate: true },
    });

    if (!trip) throw new NotFoundException('Viagem não encontrada');

    const reservations = await this.prisma.reservation.findMany({
      where: {
        tripId,
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    const confirmedCount = reservations.filter(
      (r) => r.status === ReservationStatus.CONFIRMED,
    ).length;

    const totalInvested = reservations.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );

    return {
      tripName: trip.name,
      tripPeriod: this.formatPeriod(trip.startDate, trip.endDate),
      totalReservations: reservations.length,
      confirmedCount,
      totalInvested: Math.round(totalInvested * 100) / 100,
      nextCheckinLabel: this.getNextCheckin(reservations),
      nextFlightLabel: this.getNextFlight(reservations),
      reservations: reservations.map((r) => this.formatReservation(r)),
    };
  }

  // ─── Criar reserva ────────────────────────────────────────────────────────

  async create(userId: string, tripId: string, dto: CreateReservationDto) {
    await this.tripsService.assertParticipant(userId, tripId);

    if (dto.paidById) {
      await this.assertParticipantOfTrip(tripId, dto.paidById);
    }

    const reservation = await this.prisma.reservation.create({
      data: {
        tripId,
        category: dto.category,
        title: dto.title,
        subtitle: dto.subtitle ?? this.buildSubtitle(dto.category),
        status: dto.status ?? ReservationStatus.PENDING,
        amount: dto.amount,
        paidById: dto.paidById,
        notes: dto.notes,
        details: dto.details ?? {},
      },
    });

    return this.formatReservation(reservation);
  }

  // ─── Atualizar reserva ────────────────────────────────────────────────────

  async update(
    userId: string,
    tripId: string,
    reservationId: string,
    dto: UpdateReservationDto,
  ) {
    await this.tripsService.assertParticipant(userId, tripId);
    await this.assertReservationBelongsToTrip(reservationId, tripId);

    if (dto.paidById) {
      await this.assertParticipantOfTrip(tripId, dto.paidById);
    }

    const reservation = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        ...dto,
        details: dto.details ?? undefined,
      },
    });

    return this.formatReservation(reservation);
  }

  // ─── Deletar reserva ──────────────────────────────────────────────────────

  async remove(userId: string, tripId: string, reservationId: string) {
    await this.tripsService.assertParticipant(userId, tripId);
    await this.assertReservationBelongsToTrip(reservationId, tripId);

    await this.prisma.reservation.delete({ where: { id: reservationId } });
    return { message: 'Reserva removida com sucesso' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async assertParticipantOfTrip(tripId: string, userId: string) {
    const participant = await this.prisma.tripParticipant.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (!participant) {
      throw new BadRequestException('Pagador não é participante da viagem');
    }
  }

  private async assertReservationBelongsToTrip(
    reservationId: string,
    tripId: string,
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.tripId !== tripId) {
      throw new NotFoundException('Reserva não encontrada');
    }

    return reservation;
  }

  private formatReservation(r: ReservationModel) {
    const details = (r.details as ReservationDetails | null) ?? {};

    const detailLines = this.buildDetailLines(r.category, details);
    const primaryAction = this.buildPrimaryAction(r.id, r.status, r.category);

    return {
      id: r.id,
      category: r.category.toLowerCase(),
      status: r.status.toLowerCase(),
      title: r.title,
      subtitle: r.subtitle,
      details: detailLines,
      amount: Number(r.amount),
      amountSublabel: details.amountSublabel ?? '',
      warning: details.warning ?? null,
      primaryAction,
      notes: r.notes,
      // Campos crus — usados pelo formulário de edição no frontend
      rawDetails: details,
      paidById: r.paidById ?? null,
    };
  }

  private buildDetailLines(
    category: ReservationCategory,
    details: ReservationDetails,
  ): string[] {
    switch (category) {
      case ReservationCategory.HOTEL:
        return [
          details.checkIn && details.checkOut
            ? `Check-in: ${details.checkIn} · Check-out: ${details.checkOut}`
            : '',
          details.guestCount
            ? `${details.guestCount} hóspedes · ${details.roomCount ?? ''} quartos`
            : '',
          details.address ?? '',
          details.reservationCode ? `Reserva: ${details.reservationCode}` : '',
        ].filter(Boolean);

      case ReservationCategory.FLIGHT:
        return [
          details.departureDate
            ? `Ida: ${details.departureDate} · ${details.flightNumber ?? ''} · ${details.departureTime ?? ''} → ${details.arrivalTime ?? ''}`
            : '',
          details.returnDate
            ? `Volta: ${details.returnDate} · ${details.returnFlightNumber ?? ''} · ${details.returnTime ?? ''}`
            : '',
          details.passengerCount
            ? `${details.passengerCount} passageiros · ${details.cabinClass ?? 'Economy'}`
            : '',
          details.locator ? `Localizador: ${details.locator}` : '',
        ].filter(Boolean);

      case ReservationCategory.CAR:
        return [
          details.pickupDate
            ? `Retirada: ${details.pickupDate} ${details.pickupTime ?? ''} · Devolução: ${details.returnDate ?? ''} ${details.returnTime ?? ''}`
            : '',
          details.carModel ?? '',
          details.pickupLocation ?? '',
          details.reservationCode ? `Reserva: ${details.reservationCode}` : '',
        ].filter(Boolean);

      case ReservationCategory.TOUR:
        return [
          details.date
            ? `${details.date} · ${details.startTime ?? ''} às ${details.endTime ?? ''}`
            : '',
          details.peopleCount ? `${details.peopleCount} pessoas` : '',
          details.meetingPoint ?? '',
        ].filter(Boolean);

      default:
        return [];
    }
  }

  private buildPrimaryAction(
    id: string,
    status: ReservationStatus,
    category: ReservationCategory,
  ) {
    if (status === ReservationStatus.PENDING) {
      return { label: 'Pagar', icon: 'pay', href: '#' };
    }
    if (category === ReservationCategory.FLIGHT) {
      return { label: 'Ver passagens', icon: 'tickets', href: '#' };
    }
    return { label: 'Ver voucher', icon: 'voucher', href: '#' };
  }

  private buildSubtitle(category: ReservationCategory): string {
    const map: Record<ReservationCategory, string> = {
      HOTEL: 'Hospedagem',
      FLIGHT: 'Passagem',
      CAR: 'Transporte',
      TOUR: 'Passeio',
    };
    return map[category] ?? '';
  }

  private getNextCheckin(reservations: ReservationModel[]): string {
    const hotel = reservations.find(
      (r) =>
        r.category === ReservationCategory.HOTEL &&
        r.status === ReservationStatus.CONFIRMED,
    );
    if (!hotel) return 'N/A';
    const details = hotel.details as ReservationDetails | null;
    return details?.checkIn ?? 'N/A';
  }

  private getNextFlight(reservations: ReservationModel[]): string {
    const flight = reservations.find(
      (r) =>
        r.category === ReservationCategory.FLIGHT &&
        r.status === ReservationStatus.CONFIRMED,
    );
    if (!flight) return 'N/A';
    const details = flight.details as ReservationDetails | null;
    return details?.returnDate ?? details?.departureDate ?? 'N/A';
  }

  private formatPeriod(start: Date, end: Date): string {
    const startDay = start.getDate();
    const endDay = end.getDate();
    const month = end
      .toLocaleDateString('pt-BR', { month: 'short' })
      .replace('.', '');
    const year = end.getFullYear();
    return `${startDay}–${endDay} ${month} ${year}`;
  }
}
