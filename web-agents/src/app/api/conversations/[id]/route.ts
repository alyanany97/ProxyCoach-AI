import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * GET /api/conversations/[id]
 * Get a specific conversation with all its messages
 */
export async function GET(
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

    // Fetch conversation with messages - ensure user can only access their own conversations
    const whereClause = userId
      ? { id, userId: userId }
      : { id, sessionId: sessionId };
    
    const conversation = await prisma.conversation.findFirst({
      where: whereClause,
      include: {
        messages: {
          include: {
            attachments: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
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

    // Format messages for frontend
    const messages = conversation.messages.map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      timestamp: msg.createdAt,
      attachments: msg.attachments.map((att) => ({
        id: att.id,
        fileName: att.fileName,
        fileType: att.fileType,
        fileSize: att.fileSize,
        fileUrl: att.fileUrl,
        dataUrl: att.fileUrl, // Use fileUrl as dataUrl for display
      })),
    }));

    return Response.json({
      id: conversation.id,
      title: conversation.title,
      timestamp: conversation.updatedAt,
      messages,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch conversation",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * PATCH /api/conversations/[id]
 * Update a conversation (e.g., update title)
 */
export async function PATCH(
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
    const { title } = body;

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

    // Update conversation - ensure user can only update their own conversations
    const whereClause = userId
      ? { id, userId: userId }
      : { id, sessionId: sessionId };
    
    const conversation = await prisma.conversation.updateMany({
      where: whereClause,
      data: {
        ...(title && { title }),
        updatedAt: new Date(),
      },
    });

    if (conversation.count === 0) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating conversation:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to update conversation",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * DELETE /api/conversations/[id]
 * Delete a conversation
 */
export async function DELETE(
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

    // Delete conversation (messages will be cascade deleted) - ensure user can only delete their own conversations
    const whereClause = userId
      ? { id, userId: userId }
      : { id, sessionId: sessionId };
    
    const result = await prisma.conversation.deleteMany({
      where: whereClause,
    });

    if (result.count === 0) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to delete conversation",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

