import type { WorkerRequest, WorkerResponse, SerializedState, SerializedMove } from '../../solver/workerProtocol';

type ResponseHandler = (msg: WorkerResponse) => void;

export class WorkerClient {
  private worker: Worker | null = null;
  private pending: ResponseHandler | null = null;

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../../solver/solverWorker.ts', import.meta.url),
        { type: 'module' },
      );
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (this.pending) {
          this.pending(e.data);
          this.pending = null;
        }
      };
    }
    return this.worker;
  }

  async solve(
    state: SerializedState,
    n0 = 1,
    n1 = 1,
    maxTime = 60,
  ): Promise<{ moves: SerializedMove[]; win: boolean; nodesSearched: number }> {
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      this.pending = (msg) => {
        if (msg.type === 'solution') {
          resolve({ moves: msg.moves, win: msg.win, nodesSearched: msg.nodesSearched });
        } else if (msg.type === 'error') {
          reject(new Error(msg.message));
        }
      };
      const req: WorkerRequest = { type: 'solve', state, n0, n1, maxTime };
      worker.postMessage(req);
    });
  }

  async hint(state: SerializedState, maxTime = 3): Promise<SerializedMove | null> {
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      this.pending = (msg) => {
        if (msg.type === 'hint') {
          resolve(msg.move);
        } else if (msg.type === 'error') {
          reject(new Error(msg.message));
        }
      };
      const req: WorkerRequest = { type: 'hint', state, maxTime };
      worker.postMessage(req);
    });
  }

  cancel(): void {
    if (this.worker) {
      const req: WorkerRequest = { type: 'cancel' };
      this.worker.postMessage(req);
    }
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.pending = null;
    }
  }
}

// Singleton
let _client: WorkerClient | null = null;
export function getWorkerClient(): WorkerClient {
  if (!_client) _client = new WorkerClient();
  return _client;
}
