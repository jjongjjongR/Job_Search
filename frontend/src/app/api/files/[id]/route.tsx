// // app/api/files/[id]/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma"; // Prisma를 사용하는 경우
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth"; // authOptions는 /api/auth/[...nextauth]에서 사용한 것
// import { isAdmin } from "@/lib/isAdmin";

// export async function DELETE(
//   req: NextRequest,
//   { params }: { params: { id: string } }
// ) {
//   const session = await getServerSession(authOptions);

//   if (!session || !isAdmin(session)) {
//     return new NextResponse("권한이 없습니다.", { status: 403 });
//   }

//   const fileId = Number(params.id);
//   if (isNaN(fileId)) {
//     return new NextResponse("잘못된 ID입니다.", { status: 400 });
//   }

//   try {
//     await prisma.filePost.delete({
//       where: { id: fileId },
//     });
//     return new NextResponse(null, { status: 204 });
//   } catch (error) {
//     console.error("파일 삭제 실패:", error);
//     return new NextResponse("서버 에러", { status: 500 });
//   }
// }
