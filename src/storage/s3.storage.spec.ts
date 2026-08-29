import { S3Storage } from './s3.storage';

type FakeCommand = { type: string; input: Record<string, unknown> };

const send = jest.fn<Promise<unknown>, [FakeCommand]>();

// jest.mock é içado para o topo do arquivo; a factory só pode referenciar
// variáveis de fora se o acesso for adiado (dentro de uma função).
jest.mock('@aws-sdk/client-s3', () => ({
    S3Client: jest.fn().mockImplementation(() => ({ send })),
    PutObjectCommand: jest
        .fn()
        .mockImplementation((input: Record<string, unknown>) => ({
            type: 'Put',
            input,
        })),
    GetObjectCommand: jest
        .fn()
        .mockImplementation((input: Record<string, unknown>) => ({
            type: 'Get',
            input,
        })),
    DeleteObjectCommand: jest
        .fn()
        .mockImplementation((input: Record<string, unknown>) => ({
            type: 'Delete',
            input,
        })),
}));

const getSignedUrl = jest.fn<Promise<string>, [unknown, FakeCommand]>();
jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: (client: unknown, cmd: FakeCommand) =>
        getSignedUrl(client, cmd),
}));

const env: Record<string, string> = {
    S3_REGION: 'auto',
    S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
    S3_ACCESS_KEY_ID: 'ak',
    S3_SECRET_ACCESS_KEY: 'sk',
    S3_BUCKET_PUBLIC: 'tc-public',
    S3_BUCKET_PRIVATE: 'tc-private',
    S3_PUBLIC_URL: 'https://cdn.tripcontrol.app/',
};
const config = {
    get: (key: string, fallback?: string) => env[key] ?? fallback,
    getOrThrow: (key: string) => env[key],
} as unknown as ConstructorParameters<typeof S3Storage>[0];

describe('S3Storage', () => {
    let storage: S3Storage;

    beforeEach(() => {
        jest.clearAllMocks();
        send.mockResolvedValue({});
        storage = new S3Storage(config);
    });

    it('salva avatar no bucket público e devolve URL pública final', async () => {
        const result = await storage.save(
            'avatars',
            'abc.webp',
            Buffer.from('x'),
            'image/webp',
        );

        const [cmd] = send.mock.calls[0];
        expect(cmd.type).toBe('Put');
        expect(cmd.input.Bucket).toBe('tc-public');
        expect(cmd.input.Key).toBe('avatars/abc.webp');
        expect(cmd.input.ContentType).toBe('image/webp');
        expect(result.url).toBe('https://cdn.tripcontrol.app/avatars/abc.webp');
    });

    it('salva comprovante no bucket privado e devolve referência opaca', async () => {
        const result = await storage.save(
            'receipts',
            'nf.pdf',
            Buffer.from('x'),
            'application/pdf',
        );

        expect(send.mock.calls[0][0].input.Bucket).toBe('tc-private');
        expect(result.url).toBe('s3-private://receipts/nf.pdf');
    });

    it('resolve referência privada em URL assinada e mantém URLs públicas', async () => {
        getSignedUrl.mockResolvedValue('https://signed.example/nf.pdf?sig=1');

        await expect(
            storage.resolveReadUrl('s3-private://receipts/nf.pdf'),
        ).resolves.toBe('https://signed.example/nf.pdf?sig=1');
        expect(getSignedUrl.mock.calls[0][1].input).toEqual({
            Bucket: 'tc-private',
            Key: 'receipts/nf.pdf',
        });

        await expect(
            storage.resolveReadUrl('https://cdn.tripcontrol.app/avatars/a.webp'),
        ).resolves.toBe('https://cdn.tripcontrol.app/avatars/a.webp');
        await expect(storage.resolveReadUrl(null)).resolves.toBeNull();
    });

    it('remove objetos próprios e ignora URLs externas', async () => {
        await storage.deleteByUrl('https://cdn.tripcontrol.app/avatars/a.webp');
        expect(send.mock.calls[0][0].input).toEqual({
            Bucket: 'tc-public',
            Key: 'avatars/a.webp',
        });

        await storage.deleteByUrl('s3-private://receipts/nf.pdf');
        expect(send.mock.calls[1][0].input).toEqual({
            Bucket: 'tc-private',
            Key: 'receipts/nf.pdf',
        });

        send.mockClear();
        await storage.deleteByUrl('https://lh3.googleusercontent.com/foto.jpg');
        await storage.deleteByUrl('/uploads/avatars/legado.png');
        await storage.deleteByUrl(null);
        expect(send).not.toHaveBeenCalled();
    });

    it('não propaga erro de remoção', async () => {
        send.mockRejectedValueOnce(new Error('boom'));
        await expect(
            storage.deleteByUrl('s3-private://receipts/nf.pdf'),
        ).resolves.toBeUndefined();
    });
});