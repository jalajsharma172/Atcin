import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
    try {
        const data = await request.json();

        // Validate that we have a code
        if (!data.code) {
            return NextResponse.json(
                { success: false, error: 'Airport code is required' },
                { status: 400 }
            );
        }

        // Sanitize code to prevent directory traversal
        // Allow alphanumeric chars only
        const sanitizedCode = data.code.replace(/[^a-zA-Z0-9]/g, '');

        if (!sanitizedCode) {
            return NextResponse.json(
                { success: false, error: 'Invalid airport code' },
                { status: 400 }
            );
        }

        const fileName = `${sanitizedCode}.json`;
        const filePath = path.join(process.cwd(), 'public', 'data', 'airports', fileName); // Using public/data/airports as requested

        // Create directory if it doesn't exist (though it likely does based on context)
        const dirPath = path.dirname(filePath);
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }

        const jsonString = JSON.stringify(data, null, 2);

        await fs.writeFile(filePath, jsonString, 'utf-8');

        return NextResponse.json({ success: true, message: `Saved to ${fileName}` });
    } catch (error) {
        console.error('Error saving airport file:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to save file' },
            { status: 500 }
        );
    }
}
