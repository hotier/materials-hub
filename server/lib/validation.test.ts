import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateFileExt, validateFileSize, parseTags, uploadSchema, FileExt } from '../lib/validation';

describe('validation library', () => {
  describe('validateFileExt', () => {
    const allowedExts: FileExt[] = [
      'html', 'htm', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico',
      'json', 'txt', 'md', 'csv', 'xml', 'css', 'js', 'ts', 'yaml', 'yml',
      'log', 'sql', 'pdf',
      'doc', 'docx', 'docm', 'dotx', 'dotm', 'rtf',
      'xls', 'xlsx', 'xlsm', 'xltx', 'xlsb',
      'ppt', 'pptx', 'pptm', 'potx', 'ppsx',
      'vsd', 'vsdx', 'pub',
      'odt', 'ods', 'odp', 'odg',
    ];

    it.each(allowedExts)('should allow %s', (ext) => {
      expect(validateFileExt(`test.${ext}`)).toBe(ext);
    });

    it('should return null for blocked extensions', () => {
      expect(validateFileExt('test.exe')).toBeNull();
      expect(validateFileExt('test.bat')).toBeNull();
      expect(validateFileExt('evil.jar')).toBeNull();
    });

    it('should handle case insensitive', () => {
      expect(validateFileExt('TEST.PDF')).toBe('pdf');
      expect(validateFileExt('Test.JpG')).toBe('jpg');
    });

    it('should handle filenames without extension', () => {
      expect(validateFileExt('filename')).toBeNull();
    });

    it('should handle multiple dots', () => {
      expect(validateFileExt('my.file.name.txt')).toBe('txt');
    });
  });

  describe('validateFileSize', () => {
    it('should allow files under 10MB', () => {
      expect(validateFileSize(1024)).toBe(true); // 1KB
      expect(validateFileSize(1024 * 1024)).toBe(true); // 1MB
      expect(validateFileSize(9 * 1024 * 1024)).toBe(true); // 9MB
      expect(validateFileSize(10 * 1024 * 1024)).toBe(true); // 10MB exactly
    });

    it('should reject files over 10MB', () => {
      expect(validateFileSize(11 * 1024 * 1024)).toBe(false); // 11MB
      expect(validateFileSize(100 * 1024 * 1024)).toBe(false); // 100MB
    });
  });

  describe('parseTags', () => {
    it('should parse comma-separated tags', () => {
      expect(parseTags('tag1,tag2,tag3')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should trim whitespace', () => {
      expect(parseTags(' tag1 , tag2 , tag3 ')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should filter empty tags', () => {
      expect(parseTags('tag1,,tag2,')).toEqual(['tag1', 'tag2']);
    });

    it('should handle empty string', () => {
      expect(parseTags('')).toEqual([]);
    });

    it('should keep tag content as-is (no truncation)', () => {
      const longTag = 'a'.repeat(50);
      expect(parseTags(`${longTag},short`)).toEqual([longTag, 'short']);
    });

    it('should not limit number of tags', () => {
      const tags = Array(15).fill('tag').map((t, i) => `${t}${i}`);
      const result = parseTags(tags.join(','));
      expect(result.length).toBe(15);
    });
  });

  describe('uploadSchema', () => {
    it('should validate valid upload data', () => {
      const result = uploadSchema.parse({
        name: 'Test File',
        desc: 'Description',
        tags: 'tag1,tag2',
      });
      expect(result.name).toBe('Test File');
      expect(result.desc).toBe('Description');
      expect(result.tags).toBe('tag1,tag2');
    });

    it('should reject name too long', () => {
      expect(() => uploadSchema.parse({
        name: 'a'.repeat(61),
        desc: '',
        tags: '',
      })).toThrow();
    });

    it('should reject desc too long', () => {
      expect(() => uploadSchema.parse({
        name: 'Test',
        desc: 'a'.repeat(201),
        tags: '',
      })).toThrow();
    });

    it('should allow long tags string (no max length)', () => {
      const result = uploadSchema.parse({
        name: 'Test',
        desc: '',
        tags: 'a'.repeat(501),
      });
      expect(result.tags).toBe('a'.repeat(501));
    });

    it('should reject empty name (name is required)', () => {
      expect(() => uploadSchema.parse({
        name: '',
        desc: '',
        tags: '',
      })).toThrow();
    });
  });
});
