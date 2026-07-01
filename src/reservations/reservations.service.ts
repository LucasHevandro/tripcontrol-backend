import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TripsService } from '../trips/trips.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import {
    ReservationCategory,
    ReservationStatus,
} from '../generated/prisma/client';

@Injectable()
export class ReservationsService {
    constructor(
        private prisma: PrismaService,
        private tripsService: TripsService,
    ) { }

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

        // Estatísticas do topo
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

    private formatReservation(r: any) {
        const details = r.details as Record<string, any> ?? {};

        // Monta a lista de detalhes específicos por categoria
        const detailLines = this.buildDetailLines(r.category, details);

        // Determina a ação primária pelo status e categoria
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
        };
    }

    private buildDetailLines(
        category: ReservationCategory,
        details: Record<string, any>,
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

    private getNextCheckin(reservations: any[]): string {
        const hotel = reservations.find(
            (r) =>
                r.category === ReservationCategory.HOTEL &&
                r.status === ReservationStatus.CONFIRMED,
        );
        if (!hotel) return 'N/A';
        const details = hotel.details as Record<string, any>;
        return details?.checkIn ?? 'N/A';
    }

    private getNextFlight(reservations: any[]): string {
        const flight = reservations.find(
            (r) =>
                r.category === ReservationCategory.FLIGHT &&
                r.status === ReservationStatus.CONFIRMED,
        );
        if (!flight) return 'N/A';
        const details = flight.details as Record<string, any>;
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