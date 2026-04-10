import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * POST /api/conversations/[id]/messages
 * Add a message to a conversation
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get authenticated user
    const session = await auth();
    const userId = session?.user?.id;
    
    // Get session ID for anonymous users
    const sessionId = req.headers.get("x-session-id") || req.nextUrl.searchParams.get("sessionId");
    const body = await req.json();
    const { role, content, updateTitle, attachments } = body;

    // Must have either userId (logged in) or sessionId (anonymous)
    if (!userId && !sessionId) {
      return new Response(
        JSON.stringify({ error: "Authentication or session ID is required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!role || !content) {
      return new Response(
        JSON.stringify({ error: "Role and content are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Verify conversation exists and belongs to user/session
    const whereClause = userId
      ? { id, userId: userId }
      : { id, sessionId: sessionId };
    
    const conversation = await prisma.conversation.findFirst({
      where: whereClause,
    });

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create message with attachments
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        role,
        content,
        attachments: attachments && Array.isArray(attachments) && attachments.length > 0
          ? {
              create: attachments.map((att: { fileName: string; fileType: string; fileSize: number; fileUrl?: string; dataUrl?: string }) => ({
                fileName: att.fileName,
                fileType: att.fileType,
                fileSize: att.fileSize,
                fileUrl: att.fileUrl || att.dataUrl || null, // Store data URL or file URL
              })),
            }
          : undefined,
      },
      include: {
        attachments: true,
      },
    });

    // Update conversation title if this is the first user message and updateTitle is true
    if (updateTitle && role === "user" && conversation.title === "New Conversation") {
      // Use first 50 chars of user message as title
      const newTitle = content.substring(0, 50).trim();
      if (newTitle) {
        await prisma.conversation.update({
          where: { id },
          data: { title: newTitle, updatedAt: new Date() },
        });
      }
    } else {
      // Just update the updatedAt timestamp
      await prisma.conversation.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
    }

    return Response.json({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.createdAt,
      attachments: message.attachments.map((att) => ({
        id: att.id,
        fileName: att.fileName,
        fileType: att.fileType,
        fileSize: att.fileSize,
        fileUrl: att.fileUrl,
      })),
    });
  } catch (error) {
    console.error("Error creating message:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to create message",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

