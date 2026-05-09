import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, take, toArray } from 'rxjs';
import { TimingAlertSseService } from './timing-alert-sse.service';

describe('TimingAlertSseService', () => {
  let service: TimingAlertSseService;

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [TimingAlertSseService],
    }).compile();
    service = mod.get(TimingAlertSseService);
  });

  it('TA-13 emit + subscribe per race', async () => {
    const stream = service.subscribe('race-A').pipe(take(2), toArray());
    const promise = firstValueFrom(stream);

    // Defer emit to next tick so subscribe is set up
    setTimeout(() => {
      service.emit('alert.created', 'race-A', { bib: '98898' });
      service.emit('alert.updated', 'race-A', { bib: '98898', status: 'OPEN' });
    }, 10);

    const events = await promise;
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('alert.created');
    expect(JSON.parse(events[0].data).bib).toBe('98898');
    expect(events[1].type).toBe('alert.updated');
  });

  it('filters events by raceId — race=race-A subscriber không nhận race=race-B event', async () => {
    const received: any[] = [];
    const sub = service.subscribe('race-A').subscribe((e) => received.push(e));

    service.emit('alert.created', 'race-B', { bib: '111' }); // wrong race
    service.emit('alert.created', 'race-A', { bib: '222' }); // correct
    await new Promise((r) => setTimeout(r, 20));

    expect(received).toHaveLength(1);
    expect(JSON.parse(received[0].data).bib).toBe('222');
    sub.unsubscribe();
  });

  it('multiple subscribers receive same event', async () => {
    const sub1: any[] = [];
    const sub2: any[] = [];
    const a = service.subscribe('race-A').subscribe((e) => sub1.push(e));
    const b = service.subscribe('race-A').subscribe((e) => sub2.push(e));

    service.emit('alert.created', 'race-A', { bib: 'x' });
    await new Promise((r) => setTimeout(r, 20));

    expect(sub1).toHaveLength(1);
    expect(sub2).toHaveLength(1);
    a.unsubscribe();
    b.unsubscribe();
  });
});
