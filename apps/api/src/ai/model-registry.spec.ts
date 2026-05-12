import { AUTO_MODEL_ID, MODEL_REGISTRY, SELECTABLE_MODEL_IDS, getModelEntry, isAllowlistedModel, getPublicModelList, getModelByTier } from './model-registry';
import { OPENROUTER_MODELS } from './providers/openrouter.provider';
import { AgentService } from './agent.service';

// ── Registry unit tests ────────────────────────────────────────────────────────

describe('MODEL_REGISTRY', () => {
  it('contains exactly 3 selectable models', () => {
    expect(MODEL_REGISTRY.filter(m => m.isSelectable)).toHaveLength(3);
  });

  it('IDs match OPENROUTER_MODELS tiers', () => {
    expect(MODEL_REGISTRY.find(m => m.tier === 'free')?.id).toBe(OPENROUTER_MODELS.FREE);
    expect(MODEL_REGISTRY.find(m => m.tier === 'tool')?.id).toBe(OPENROUTER_MODELS.CHEAP);
    expect(MODEL_REGISTRY.find(m => m.tier === 'smart')?.id).toBe(OPENROUTER_MODELS.SMART);
  });

  it('free tier model has no image or tool support', () => {
    const free = MODEL_REGISTRY.find(m => m.tier === 'free');
    expect(free).toBeDefined();
    expect(free?.capabilities.supportsImages).toBe(false);
    expect(free?.capabilities.supportsTools).toBe(false);
  });

  it('tool/smart tier models support both images and tools', () => {
    for (const m of MODEL_REGISTRY.filter(e => e.tier !== 'free')) {
      expect(m.capabilities.supportsImages).toBe(true);
      expect(m.capabilities.supportsTools).toBe(true);
    }
  });
});

describe('isAllowlistedModel', () => {
  it('accepts "auto"', () => expect(isAllowlistedModel(AUTO_MODEL_ID)).toBe(true));
  it('accepts known selectable model IDs', () => {
    for (const id of SELECTABLE_MODEL_IDS) {
      expect(isAllowlistedModel(id)).toBe(true);
    }
  });
  it('rejects unknown model IDs', () => {
    expect(isAllowlistedModel('openai/gpt-4o')).toBe(false);
    expect(isAllowlistedModel('')).toBe(false);
    expect(isAllowlistedModel('auto-extra')).toBe(false);
  });
});

describe('getModelByTier', () => {
  it('resolves tier to the correct model ID', () => {
    expect(getModelByTier('free').id).toBe(OPENROUTER_MODELS.FREE);
    expect(getModelByTier('tool').id).toBe(OPENROUTER_MODELS.CHEAP);
    expect(getModelByTier('smart').id).toBe(OPENROUTER_MODELS.SMART);
  });

  it('OPENROUTER_MODELS is order-independent — matches tier lookup', () => {
    expect(OPENROUTER_MODELS.FREE).toBe(MODEL_REGISTRY.find(m => m.tier === 'free')?.id);
    expect(OPENROUTER_MODELS.CHEAP).toBe(MODEL_REGISTRY.find(m => m.tier === 'tool')?.id);
    expect(OPENROUTER_MODELS.SMART).toBe(MODEL_REGISTRY.find(m => m.tier === 'smart')?.id);
  });
});

describe('getPublicModelList', () => {
  it('first entry is Auto with Default badge', () => {
    const list = getPublicModelList();
    expect(list[0].id).toBe(AUTO_MODEL_ID);
    expect(list[0].badge).toBe('Default');
  });

  it('does not expose tier or capabilities', () => {
    const list = getPublicModelList();
    for (const entry of list) {
      expect(entry).not.toHaveProperty('tier');
      expect(entry).not.toHaveProperty('capabilities');
    }
  });
});

// ── Resolver unit tests ────────────────────────────────────────────────────────

function makeService() {
  return new AgentService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('AgentService.resolveModelSelection', () => {
  const service = makeService();
  const resolve = (msg: string, hasImage: boolean, manual?: string | null, study?: boolean) =>
    service['resolveModelSelection'](msg, hasImage, manual, study);

  describe('Auto mode', () => {
    it('resolves simple greeting to FREE model', () => {
      const state = resolve('hello', false);
      expect(state.lastModelSelectionSource).toBe('auto');
      expect(state.activeModel).toBe(OPENROUTER_MODELS.FREE);
      expect(state.reason).toBe('simple_query');
      expect(state.manualModel).toBeNull();
    });

    it('resolves deep query to SMART model', () => {
      const state = resolve('analyze the trends in borrowing patterns', false);
      expect(state.lastModelSelectionSource).toBe('auto');
      expect(state.activeModel).toBe(OPENROUTER_MODELS.SMART);
      expect(state.reason).toBe('deep_query');
    });

    it('resolves image request to CHEAP model', () => {
      const state = resolve('describe this', true);
      expect(state.lastModelSelectionSource).toBe('auto');
      expect(state.activeModel).toBe(OPENROUTER_MODELS.CHEAP);
      expect(state.reason).toBe('image');
    });

    it('resolves tool/catalog request to CHEAP model', () => {
      const state = resolve('search for books on databases', false);
      expect(state.lastModelSelectionSource).toBe('auto');
      expect(state.activeModel).toBe(OPENROUTER_MODELS.CHEAP);
    });

    it('resolves study session to SMART model', () => {
      const state = resolve('hello', false, null, true);
      expect(state.lastModelSelectionSource).toBe('auto');
      expect(state.activeModel).toBe(OPENROUTER_MODELS.SMART);
      expect(state.reason).toBe('study_session');
    });
  });

  describe('Manual mode', () => {
    it('uses expensive manual model for a simple task', () => {
      const state = resolve('hello', false, OPENROUTER_MODELS.SMART);
      expect(state.lastModelSelectionSource).toBe('manual');
      expect(state.activeModel).toBe(OPENROUTER_MODELS.SMART);
      expect(state.manualModel).toBe(OPENROUTER_MODELS.SMART);
    });

    it('uses manual CHEAP model for a deep query', () => {
      const state = resolve('analyze this research paper', false, OPENROUTER_MODELS.CHEAP);
      expect(state.lastModelSelectionSource).toBe('manual');
      expect(state.activeModel).toBe(OPENROUTER_MODELS.CHEAP);
    });

    it('falls back to CHEAP for image when FREE (no image support) is manual', () => {
      const state = resolve('describe this', true, OPENROUTER_MODELS.FREE);
      expect(state.lastModelSelectionSource).toBe('capability_fallback');
      expect(state.activeModel).toBe(OPENROUTER_MODELS.CHEAP);
      expect(state.manualModel).toBe(OPENROUTER_MODELS.FREE);
      expect(state.reason).toBe('image_required');
    });

    it('falls back to CHEAP for tool task when FREE (no tool support) is manual', () => {
      const state = resolve('search the catalog for books', false, OPENROUTER_MODELS.FREE);
      expect(state.lastModelSelectionSource).toBe('capability_fallback');
      expect(state.activeModel).toBe(OPENROUTER_MODELS.CHEAP);
      expect(state.manualModel).toBe(OPENROUTER_MODELS.FREE);
      expect(state.reason).toBe('tools_required');
    });

    it('preserves manualModel after capability fallback', () => {
      const state = resolve('describe this image', true, OPENROUTER_MODELS.FREE);
      expect(state.manualModel).toBe(OPENROUTER_MODELS.FREE);
      expect(state.activeModel).not.toBe(OPENROUTER_MODELS.FREE);
    });

    it('normalizes "auto" string to null (no manual model)', () => {
      const state = resolve('hello', false, 'auto');
      expect(state.manualModel).toBeNull();
      expect(state.lastModelSelectionSource).toBe('auto');
    });

    it('treats unknown/stale stored model ID as Auto (falls back to auto)', () => {
      const state = resolve('hello', false, 'some/unknown-old-model');
      expect(state.manualModel).toBeNull();
      expect(state.lastModelSelectionSource).toBe('auto');
    });
  });
});

describe('AgentService.updateConversationModel', () => {
  it('throws NotFoundException when no conversation matched', async () => {
    const prisma = {
      aiConversation: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = new AgentService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.updateConversationModel('missing-id', 'user-1', 'auto'))
      .rejects.toThrow('Conversation not found');
  });

  it('resolves without error when conversation exists', async () => {
    const prisma = {
      aiConversation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new AgentService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.updateConversationModel('conv-1', 'user-1', 'auto'))
      .resolves.toBeUndefined();
  });
});
