'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Code, PenTool, Zap, Briefcase, Users } from 'lucide-react';

const useCases = [
    {
        id: 'research',
        icon: BookOpen,
        title: 'Research projects',
        description: 'Maintain context across multiple research sessions. Keep your methodology, sources, and findings portable as you work with different AI models.',
        examples: ['Literature reviews', 'Data analysis', 'Academic writing']
    },
    {
        id: 'coding',
        icon: Code,
        title: 'Developers',
        description: 'Save your project architecture, coding preferences, and documentation. Debug complex issues without re-explaining your codebase every time.',
        examples: ['Feature development', 'Bug fixing', 'Code reviews']
    },
    {
        id: 'writing',
        icon: PenTool,
        title: 'Writing and creative work',
        description: 'Keep your voice, style guide, and project background consistent. Work on long-form content across multiple sessions without losing the thread.',
        examples: ['Content creation', 'Editing', 'Brainstorming']
    },
    {
        id: 'power',
        icon: Zap,
        title: 'Power AI Users',
        description: 'Heavy daily AI usage with custom workflows and prompt systems. Get control, structure, and portability instead of black-box memory.',
        examples: ['Custom Workflows', 'Advanced Prompting', 'Context Control']
    },
    {
        id: 'consultants',
        icon: Briefcase,
        title: 'Consultants & Analysts',
        description: 'Use AI across multiple clients with clean, separate contexts. Keep information isolated between projects for professional use.',
        examples: ['Multi-Client', 'Context Separation', 'Project Isolation']
    },
    {
        id: 'teams',
        icon: Users,
        title: 'Project Managers',
        description: 'Shared project context for faster onboarding. Create standardized AI understanding of projects for seamless knowledge transfer.',
        examples: ['Team Collaboration', 'Knowledge Sharing', 'Onboarding']
    }
];

export default function UseCaseTabs() {
    const [activeTab, setActiveTab] = useState('research');
    const activeUseCase = useCases.find(uc => uc.id === activeTab) || useCases[0];

    const goToNext = () => {
        const currentIndex = useCases.findIndex(uc => uc.id === activeTab);
        const nextIndex = (currentIndex + 1) % useCases.length;
        setActiveTab(useCases[nextIndex].id);
    };

    const getNextUseCase = () => {
        const currentIndex = useCases.findIndex(uc => uc.id === activeTab);
        const nextIndex = (currentIndex + 1) % useCases.length;
        return useCases[nextIndex];
    };

    const nextUseCase = getNextUseCase();

    return (
        <div className="space-y-8">
            {/* Subtle Navigation */}
            <div className="flex flex-wrap gap-2 justify-center">
                {useCases.map((useCase) => (
                    <button
                        key={useCase.id}
                        onClick={() => setActiveTab(useCase.id)}
                        style={{
                            backgroundColor: activeTab === useCase.id ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                            borderColor: activeTab === useCase.id ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                            color: activeTab === useCase.id ? '#ffffff' : '#9ca3af'
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-normal border transition-all duration-200 hover:border-white/10"
                    >
                        {useCase.title}
                    </button>
                ))}
            </div>

            {/* Cards Container with Preview */}
            <div className="relative max-w-6xl mx-auto overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_0.3fr] gap-4 items-center">
                    {/* Active Use Case with Animation */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                borderColor: 'rgba(255, 255, 255, 0.05)'
                            }}
                            className="relative backdrop-blur-sm border rounded-3xl p-8 md:p-12"
                        >
                            <div
                                style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
                            >
                                <activeUseCase.icon className="w-8 h-8 text-white/80" />
                            </div>

                            <h3 className="text-2xl text-white mb-4 font-normal">
                                {activeUseCase.title}
                            </h3>

                            <p className="text-gray-500 mb-6 leading-relaxed font-normal">
                                {activeUseCase.description}
                            </p>

                            <div className="flex flex-wrap gap-2">
                                {activeUseCase.examples.map((example, i) => (
                                    <span
                                        key={i}
                                        style={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            borderColor: 'rgba(255, 255, 255, 0.1)'
                                        }}
                                        className="px-4 py-2 border text-sm text-gray-400 rounded-full hover:bg-white/10 transition-colors cursor-default"
                                    >
                                        {example}
                                    </span>
                                ))}
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Clickable Faded Preview Card - Next Use Case */}
                    <div className="hidden md:block relative">
                        <button
                            onClick={goToNext}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                                borderColor: 'rgba(255, 255, 255, 0.03)',
                                opacity: 0.4,
                                transform: 'scale(0.95)'
                            }}
                            className="relative backdrop-blur-sm border rounded-3xl p-6 h-full w-full text-left transition-all duration-200 hover:opacity-60 hover:scale-100 cursor-pointer"
                        >
                            <div
                                style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                                className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
                            >
                                <nextUseCase.icon className="w-6 h-6 text-white/60" />
                            </div>

                            <h3 className="text-lg text-white/60 mb-2 font-normal">
                                {nextUseCase.title}
                            </h3>

                            <p className="text-gray-600 text-sm leading-relaxed font-normal line-clamp-3">
                                {nextUseCase.description}
                            </p>
                        </button>

                        {/* Fade overlay to the right */}
                        <div
                            style={{
                                background: 'linear-gradient(to right, transparent, #0E0E0E)',
                                pointerEvents: 'none'
                            }}
                            className="absolute inset-0 rounded-3xl"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
