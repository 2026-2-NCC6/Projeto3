import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Rate limit por IP; nas rotas de credenciais, por IP + e-mail (A07: força bruta). */
@Injectable()
export class LimiteGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === 'string' ? `${req.ip}:${email.trim().toLowerCase()}` : String(req.ip);
  }
}
