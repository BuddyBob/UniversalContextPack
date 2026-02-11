// Content script for extracting ChatGPT conversations
// This script runs on chat.openai.com pages

// Format memory tree JSON into clean markdown for ChatGPT
function formatMemoryTree(memoryData: any): string {
    try {
        const tree = typeof memoryData === 'string' ? JSON.parse(memoryData) : memoryData;
        const memory = tree.memory_tree || tree;

        let formatted = `# Context Pack: ${memory.pack_name || 'Unknown Pack'}\n\n`;
        formatted += `${memory.prompt || 'Use this structured memory data to understand the user\'s profile and knowledge.'}\n\n`;

        if (memory.scopes?.user_profile) {
            const profile = memory.scopes.user_profile;

            // Identity
            if (profile.Identity?.length > 0) {
                formatted += `## User Profile\n`;
                const identity = profile.Identity[0].data;
                if (identity.name) formatted += `**Name:** ${identity.name}\n`;
                if (identity.roles?.length > 0) formatted += `**Roles:** ${identity.roles.join(', ')}\n`;
                if (identity.background?.length > 0) {
                    formatted += `**Background:**\n`;
                    identity.background.forEach((bg: string) => formatted += `- ${bg}\n`);
                }
                formatted += `\n`;
            }

            // Goals - show all
            if (profile.Goal?.length > 0) {
                formatted += `## Goals\n`;
                profile.Goal.forEach((goal: any) => {
                    formatted += `- ${goal.data?.text || goal.label}\n`;
                });
                formatted += `\n`;
            }

            // Skills - show all
            if (profile.Skill?.length > 0) {
                formatted += `## Skills\n`;
                profile.Skill.forEach((skill: any) => {
                    formatted += `- ${skill.data?.text || skill.label}\n`;
                });
                formatted += `\n`;
            }

            // Projects
            if (profile.Project?.length > 0) {
                formatted += `## Active Projects\n`;
                profile.Project.forEach((project: any) => {
                    if (project.data?.status === 'active') {
                        formatted += `**${project.data.name}:** ${project.data.description || project.label}\n\n`;
                    }
                });
            }

            // Facts - NEW section
            if (profile.Fact?.length > 0) {
                formatted += `## Key Facts\n`;
                profile.Fact.forEach((fact: any) => {
                    formatted += `- ${fact.data?.text || fact.label}\n`;
                });
                formatted += `\n`;
            }

            // Constraints - NEW section
            if (profile.Constraint?.length > 0) {
                formatted += `## Constraints & Challenges\n`;
                profile.Constraint.forEach((constraint: any) => {
                    formatted += `- ${constraint.data?.text || constraint.label}\n`;
                });
                formatted += `\n`;
            }

            // Preferences - show all
            if (profile.Preference?.length > 0) {
                formatted += `## Preferences\n`;
                profile.Preference.forEach((pref: any) => {
                    formatted += `- ${pref.data?.text || pref.label}\n`;
                });
                formatted += `\n`;
            }
        }

        return formatted;
    } catch (error) {
        console.error('Error formatting memory tree:', error);
        return memoryData; // Fallback to original data
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractConversation') {
        try {
            // Extract conversation from ChatGPT page
            const conversationTitle = document.querySelector('h1')?.textContent || 'Untitled Conversation';

            // Find all message elements
            const messageElements = document.querySelectorAll('[data-message-author-role]');
            const messages: Array<{ role: string, content: string }> = [];

            messageElements.forEach((el) => {
                const role = el.getAttribute('data-message-author-role') || 'unknown';
                const contentEl = el.querySelector('.markdown, .text-message');
                const content = contentEl?.textContent?.trim() || '';

                if (content) {
                    messages.push({ role, content });
                }
            });

            if (messages.length === 0) {
                sendResponse({ success: false, error: 'No messages found in conversation' });
                return;
            }

            sendResponse({
                success: true,
                conversation: {
                    title: conversationTitle,
                    messages: messages
                }
            });
        } catch (error) {
            console.error('Error extracting conversation:', error);
            sendResponse({ success: false, error: (error as Error).message });
        }
    }

    if (message.action === 'insertMemoryTree') {
        try {
            // Find the ChatGPT input - it's a contenteditable div, not a textarea
            const inputDiv = document.querySelector('#prompt-textarea[contenteditable="true"]') as HTMLElement;

            if (!inputDiv) {
                sendResponse({ success: false, error: 'Could not find ChatGPT input field' });
                return;
            }

            // Format the memory tree into clean markdown
            const formattedTree = formatMemoryTree(message.memoryTree);

            // For contenteditable divs, we need to set innerHTML or textContent
            // Clear existing content and insert the formatted memory tree
            inputDiv.textContent = formattedTree;

            // Trigger input event to notify ChatGPT
            inputDiv.dispatchEvent(new Event('input', { bubbles: true }));
            inputDiv.focus();

            sendResponse({ success: true });
        } catch (error) {
            console.error('Error inserting memory tree:', error);
            sendResponse({ success: false, error: (error as Error).message });
        }
    }

    return true; // Keep channel open for async response
});
