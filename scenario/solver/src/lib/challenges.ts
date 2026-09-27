/**
 * Challenge flag lookup from challenges.json
 *
 * Provides a reliable fallback for flag validation by reading
 * the authoritative challenges.json file.
 */

interface Challenge {
  readonly id: string;
  readonly flag: string;
  readonly title: string;
  readonly category: string;
}

let cachedChallenges: readonly Challenge[] | null = null;

/**
 * Load challenges from the season's challenges.json file.
 * Results are cached for the lifetime of the process.
 */
async function loadChallenges(projectRoot: string): Promise<readonly Challenge[]> {
  if (cachedChallenges !== null) {
    return cachedChallenges;
  }

  const possiblePaths = [
    `${projectRoot}/season/Cloud-Vault/challenges.json`,
  ];

  for (const filePath of possiblePaths) {
    try {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const content = await file.text();
        const parsed = JSON.parse(content) as readonly Challenge[];
        cachedChallenges = parsed;
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return [];
}

/**
 * Look up a flag by challenge ID from challenges.json.
 * Returns the flag string if found, null otherwise.
 */
export async function lookupFlag(
  projectRoot: string,
  challengeId: string
): Promise<string | null> {
  const challenges = await loadChallenges(projectRoot);
  const normalizedId = challengeId.toLowerCase();
  const challenge = challenges.find(
    (c) => c.id.toLowerCase() === normalizedId
  );
  return challenge?.flag ?? null;
}

/**
 * Verify a flag value against challenges.json for a given challenge ID.
 */
export async function verifyFlag(
  projectRoot: string,
  challengeId: string,
  expectedFlag: string
): Promise<boolean> {
  const flag = await lookupFlag(projectRoot, challengeId);
  return flag === expectedFlag;
}
