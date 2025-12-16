import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'

const postsDirectory = path.join(process.cwd(), 'content/blog')

export interface BlogPost {
    slug: string
    title: string
    description: string
    date: string
    author: string
    category: string
    readingTime: string
    content: string
}

export function getAllPosts(): BlogPost[] {
    // Get file names under /content/blog
    const fileNames = fs.readdirSync(postsDirectory)

    const allPostsData = fileNames
        .filter(fileName => fileName.endsWith('.mdx') || fileName.endsWith('.md'))
        .map(fileName => {
            // Remove .mdx extension to get slug
            const slug = fileName.replace(/\.mdx?$/, '')

            // Read markdown file as string
            const fullPath = path.join(postsDirectory, fileName)
            const fileContents = fs.readFileSync(fullPath, 'utf8')

            // Use gray-matter to parse the post metadata section
            const { data, content } = matter(fileContents)

            // Calculate reading time
            const stats = readingTime(content)

            // Combine the data with the slug
            return {
                slug,
                title: data.title,
                description: data.description,
                date: data.date,
                author: data.author || 'Context Pack Team',
                category: data.category || 'General',
                readingTime: stats.text,
                content,
            }
        })

    // Sort posts by date (newest first)
    return allPostsData.sort((a, b) => {
        if (a.date < b.date) {
            return 1
        } else {
            return -1
        }
    })
}

export function getPostBySlug(slug: string): BlogPost | null {
    try {
        const fullPath = path.join(postsDirectory, `${slug}.mdx`)
        const fileContents = fs.readFileSync(fullPath, 'utf8')
        const { data, content } = matter(fileContents)
        const stats = readingTime(content)

        return {
            slug,
            title: data.title,
            description: data.description,
            date: data.date,
            author: data.author || 'Context Pack Team',
            category: data.category || 'General',
            readingTime: stats.text,
            content,
        }
    } catch (error) {
        return null
    }
}

export function getAllSlugs(): string[] {
    const fileNames = fs.readdirSync(postsDirectory)
    return fileNames
        .filter(fileName => fileName.endsWith('.mdx') || fileName.endsWith('.md'))
        .map(fileName => fileName.replace(/\.mdx?$/, ''))
}
