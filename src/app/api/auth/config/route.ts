import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    const status = getMicrosoftSSOStatus();

    return NextResponse.json({
      microsoftSSO: {
        available: status.isConfigured,
        missingVars: status.missingVars,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get auth configuration' },
      { status: 500 }
    );
  }
}

/**
 * Gets the Microsoft SSO configuration status
 * @returns object - containing configuration status and missing variables
 */
export function getMicrosoftSSOStatus() {
  const clientId = !!process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = !!process.env.AZURE_AD_CLIENT_SECRET;
  const tenantId = !!process.env.AZURE_AD_TENANT_ID;

  const isConfigured = clientId && clientSecret && tenantId;

  return {
    isConfigured,
    missingVars: [
      !clientId ? 'AZURE_AD_CLIENT_ID' : null,
      !clientSecret ? 'AZURE_AD_CLIENT_SECRET' : null,
      !tenantId ? 'AZURE_AD_TENANT_ID' : null,
    ].filter(Boolean) as string[],
  };
}
