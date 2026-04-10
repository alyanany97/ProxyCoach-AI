import { Conversation } from "@/types/conversation";

/**
 * Mock conversation data for development and testing
 */
export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    title: "Project Planning Discussion",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    preview: "Let's discuss the project timeline and deliverables...",
    unreadCount: 2,
  },
  {
    id: "2",
    title: "Code Review Session",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    preview: "I've reviewed the pull request and have some suggestions...",
  },
  {
    id: "3",
    title: "API Integration Help",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    preview: "Can you help me with the authentication flow?",
    unreadCount: 1,
  },
  {
    id: "4",
    title: "Design System Questions",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    preview: "What are the spacing guidelines for the new components?",
  },
  {
    id: "5",
    title: "Database Schema Discussion",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    preview: "We need to update the schema to support the new features...",
  },
  {
    id: "6",
    title: "Performance Optimization",
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    preview: "The query is taking too long. Let's optimize it...",
  },
  {
    id: "7",
    title: "Team Standup Notes",
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    preview: "Updates from today's standup meeting...",
  },
  {
    id: "8",
    title: "Feature Request Discussion",
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    preview: "The client wants to add a new feature...",
  },
];


