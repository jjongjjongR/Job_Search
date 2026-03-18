import { NextResponse } from 'next/server';

export async function DELETE() {
  return NextResponse.json(
    {
      message:
        '이 자료실 삭제 API는 현재 1차 인증 범위 밖이라 아직 구현되지 않았습니다.',
    },
    { status: 501 },
  );
}
