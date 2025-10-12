import type { AIProviderId, AIProviderInfo, ProviderSelection } from '@/types/ai';

const PROVIDER_ALIASES: Record<string, AIProviderId> = {
  openai: 'openai',
  'open-ai': 'openai',
  gpt: 'openai',
  anthropic: 'anthropic',
  claude: 'anthropic',
  'anthropic-claude': 'anthropic',
  google: 'google',
  gemini: 'google',
  'google-gemini': 'google'
};

export const CANONICAL_PROVIDERS: AIProviderId[] = ['openai', 'anthropic', 'google'];

export function normalizeProviderId(value?: string | null): AIProviderId | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const key = value.trim().toLowerCase();
  return PROVIDER_ALIASES[key] || null;
}

export function findProviderInfo(
  providers: AIProviderInfo[],
  providerId?: string | null
): AIProviderInfo | undefined {
  if (!Array.isArray(providers) || providers.length === 0) {
    return undefined;
  }

  const normalized = normalizeProviderId(providerId) ?? normalizeProviderId(providers[0]?.id);
  if (!normalized) {
    return providers[0];
  }

  return providers.find((provider) => provider.id === normalized) || providers[0];
}

export function resolveModelId(
  providers: AIProviderInfo[],
  providerId: AIProviderId,
  requestedModel?: string | null
): string {
  const providerInfo = findProviderInfo(providers, providerId);

  if (!providerInfo) {
    return requestedModel || providerId;
  }

  if (requestedModel) {
    const match = providerInfo.models.find((model) => model.id === requestedModel);
    if (match) {
      return match.id;
    }
    return requestedModel;
  }

  return providerInfo.defaultModel;
}

export function buildProviderSelection(
  providers: AIProviderInfo[],
  selection?: Partial<ProviderSelection>
): ProviderSelection {
  const providerInfo = findProviderInfo(providers, selection?.provider) || providers[0];
  const providerId = providerInfo.id;
  const model = resolveModelId(providers, providerId, selection?.model || providerInfo.defaultModel);

  return {
    provider: providerId,
    model
  };
}

export function getProviderDisplayName(providers: AIProviderInfo[], providerId?: string | null): string {
  const normalized = normalizeProviderId(providerId);
  const providerInfo = normalized
    ? providers.find((provider) => provider.id === normalized)
    : undefined;

  return providerInfo?.displayName || providerId || 'Unknown Provider';
}
