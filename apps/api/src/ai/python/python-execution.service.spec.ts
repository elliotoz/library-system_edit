import { PythonExecutionService } from './python-execution.service';

describe('PythonExecutionService', () => {
  const originalUrl = process.env.PYTHON_RUNNER_URL;

  afterEach(() => {
    process.env.PYTHON_RUNNER_URL = originalUrl;
    jest.restoreAllMocks();
  });

  it('returns unavailable when runner URL is missing', async () => {
    delete process.env.PYTHON_RUNNER_URL;
    const service = new PythonExecutionService();

    const result = await service.execute('print(2 + 2)');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('unavailable');
  });

  it('rejects oversized code before calling the runner', async () => {
    process.env.PYTHON_RUNNER_URL = 'http://runner:8000';
    const fetchSpy = jest.spyOn(global, 'fetch');
    const service = new PythonExecutionService();

    const result = await service.execute('x'.repeat(12001));

    expect(result.ok).toBe(false);
    expect(result.stderr).toContain('too large');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('normalizes runner success responses', async () => {
    process.env.PYTHON_RUNNER_URL = 'http://runner:8000';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        stdout: '4\n',
        stderr: '',
        result: null,
        artifacts: [],
        executionMs: 10,
      }),
    } as Response);

    const service = new PythonExecutionService();
    const result = await service.execute('print(2 + 2)');

    expect(result.ok).toBe(true);
    expect(result.stdout).toBe('4\n');
  });
});
