#!/usr/bin/env node

/**
 * Simple MCP Server for BassNotion Project Context
 * Provides project-specific context and utilities
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

class BassNotionMCPServer {
  constructor() {
    this.server = new Server(
      { name: 'bassnotion-context', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_project_context',
            description: 'Get BassNotion project context and current state',
            inputSchema: {
              type: 'object',
              properties: {
                area: {
                  type: 'string',
                  enum: ['all', 'frontend', 'backend', 'contracts', 'docs'],
                  description: 'Which area of the project to get context for',
                },
              },
              required: ['area'],
            },
          },
          {
            name: 'search_files',
            description: 'Search for files in the project',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: { type: 'string', description: 'Search pattern' },
                directory: {
                  type: 'string',
                  description: 'Directory to search in',
                },
              },
              required: ['pattern'],
            },
          },
          {
            name: 'get_midi_debug_info',
            description: 'Get debug information for MIDI parsing issues',
            inputSchema: {
              type: 'object',
              properties: {
                includeLibraries: {
                  type: 'boolean',
                  description: 'Include library information',
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_project_context':
          return await this.getProjectContext(args.area);

        case 'search_files':
          return await this.searchFiles(args.pattern, args.directory);

        case 'get_midi_debug_info':
          return await this.getMidiDebugInfo(args.includeLibraries);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async getProjectContext(area) {
    const projectRoot = process.cwd();
    const context = {
      projectRoot,
      timestamp: new Date().toISOString(),
      area,
    };

    try {
      // Read package.json for dependencies
      const packageJson = JSON.parse(
        await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'),
      );

      context.workspaceInfo = {
        name: packageJson.name,
        type: packageJson.type,
        scripts: Object.keys(packageJson.scripts || {}),
      };

      // Get current git status if possible
      try {
        const { execSync } = await import('child_process');
        const gitStatus = execSync('git status --porcelain', {
          cwd: projectRoot,
          encoding: 'utf8',
        });
        context.gitStatus = gitStatus.trim().split('\n').filter(Boolean);
      } catch (e) {
        context.gitStatus = ['Git not available'];
      }

      // Area-specific context
      switch (area) {
        case 'frontend':
        case 'backend':
        case 'contracts': {
          const areaPath = path.join(
            projectRoot,
            area === 'contracts' ? 'libs/contracts' : `apps/${area}`,
          );
          try {
            const areaPackage = JSON.parse(
              await fs.readFile(path.join(areaPath, 'package.json'), 'utf8'),
            );
            context.areaInfo = {
              dependencies: Object.keys(areaPackage.dependencies || {}),
              devDependencies: Object.keys(areaPackage.devDependencies || {}),
            };
          } catch (e) {
            context.areaInfo = { error: 'Could not read area package.json' };
          }
          break;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(context, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting project context: ${error.message}`,
          },
        ],
      };
    }
  }

  async searchFiles(pattern, directory = '.') {
    try {
      const { execSync } = await import('child_process');
      const searchPath = path.join(process.cwd(), directory);

      const results = execSync(
        `find "${searchPath}" -name "${pattern}" -type f 2>/dev/null | head -20`,
        { encoding: 'utf8' },
      );

      return {
        content: [
          {
            type: 'text',
            text: `Files matching "${pattern}" in ${directory}:\n${results}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Search error: ${error.message}`,
          },
        ],
      };
    }
  }

  async getMidiDebugInfo(includeLibraries = true) {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      midiRelatedFiles: [],
      dependencies: {},
      currentIssue: {
        error:
          'MIDI parsing failed: Invalid MIDI file - tracks property is not an array (type: number)',
        library: 'midi-parser-js@4.0.4',
        context: 'Frontend MIDI file upload',
      },
    };

    try {
      // Find MIDI-related files
      const { execSync } = await import('child_process');
      const midiFiles = execSync(
        'find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" | xargs grep -l -i midi 2>/dev/null | head -10',
        { encoding: 'utf8', cwd: process.cwd() },
      );
      debugInfo.midiRelatedFiles = midiFiles.trim().split('\n').filter(Boolean);

      if (includeLibraries) {
        // Check MIDI libraries
        const frontendPackage = JSON.parse(
          await fs.readFile('./apps/frontend/package.json', 'utf8'),
        );

        debugInfo.dependencies = {
          'midi-parser-js': frontendPackage.dependencies['midi-parser-js'],
          '@tonejs/midi': frontendPackage.dependencies['@tonejs/midi'],
          tone: frontendPackage.dependencies['tone'],
        };
      }

      debugInfo.recommendations = [
        'Consider switching from midi-parser-js to @tonejs/midi for better browser compatibility',
        'The current error suggests midi-parser-js is returning unexpected data structure',
        '@tonejs/midi is already in dependencies and more reliable for web applications',
      ];
    } catch (error) {
      debugInfo.error = error.message;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(debugInfo, null, 2),
        },
      ],
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('BassNotion MCP Server started');
  }
}

// Start the server
const server = new BassNotionMCPServer();
server.start().catch(console.error);
