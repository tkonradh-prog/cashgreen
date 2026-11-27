import { ImageResponse } from 'next/og';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(145deg, #1b2232 0%, #0b0e15 55%, #030407 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="328" height="328" viewBox="0 0 36 36" fill="none">
          <path
            d="M8.5 24.5C12.8 24.5 14.5 18.2 19.2 18.2C22.4 18.2 24 20 27.5 16.5"
            stroke="#2DD4BF"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M8.5 18.2C13 18.2 15 11.2 20 11.2C23.2 11.2 24.8 13.4 27.5 10.5"
            stroke="#FFFFFF"
            strokeWidth="3.3"
            strokeLinecap="round"
          />
          <circle cx="27.5" cy="10.5" r="2.2" fill="#FFFFFF" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
