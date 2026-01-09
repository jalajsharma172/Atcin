import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const airportsDir = path.join(process.cwd(), 'public', 'data', 'airports');
        const files = fs.readdirSync(airportsDir);

        const airports = files
            .filter(file => file.endsWith('.json') && !file.startsWith('_'))
            .map(file => {
                const filePath = path.join(airportsDir, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                return {
                    code: data.code,
                    name: data.name
                };
            });

        return NextResponse.json(airports);
    } catch (error) {
        console.error('Error reading airports:', error);
        return NextResponse.json([]);
    }
}
