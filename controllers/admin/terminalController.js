import os from 'os';
import pty from 'node-pty';

export const handleTerminalWs = (socket, req) => {
    // Determine shell based on platform
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

    // Spawn pty process
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env
    });

    // Handle data from pty
    ptyProcess.onData((data) => {
        if (socket.readyState === 1) { // OPEN
            socket.send(data);
        }
    });

    // Handle messages from client
    socket.on('message', (message) => {
        const msgStr = Buffer.isBuffer(message) ? message.toString('utf8') : message.toString();
        // Check for resize message
        try {
            if (msgStr.startsWith('{"type":"resize"')) {
                const data = JSON.parse(msgStr);
                if (data.type === 'resize' && data.cols && data.rows) {
                    ptyProcess.resize(data.cols, data.rows);
                    return;
                }
            }
        } catch (e) {
            // Ignore parse error
        }
        
        // Write to terminal
        ptyProcess.write(msgStr);
    });

    // Clean up when connection closes
    socket.on('close', () => {
        ptyProcess.kill();
    });
};
