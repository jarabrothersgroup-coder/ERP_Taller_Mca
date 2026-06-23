import os
import pathlib
import re
import subprocess

def fix_broken_schema(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    modified = False
    new_lines = []
    i = 0
    while i < len(lines):
        new_lines.append(lines[i])
        # Check if current line is just a comma
        if lines[i].strip() == ',':
            # Look ahead for the closing parenthesis
            j = i + 1
            found_closing = False
            while j < len(lines):
                if lines[j].strip() == ');':
                    found_closing = True
                    break
                if lines[j].strip() != '':
                    # Found something else before ');'
                    break
                j += 1
            
            if found_closing:
                # Replace the comma line with '}),'
                # We need to preserve the original indentation of the comma line
                indent = re.match(r'^(\s*)', lines[i]).group(1)
                new_lines[-1] = f"{indent}),\n"
                modified = True
                # Skip the lines we already checked
                i = j
                continue
        i += 1

    if modified:
        with open(file_path, 'w') as f:
            f.writelines(new_lines)
        print(f"Fixed: {file_path}")
    else:
        print(f"No changes needed for: {file_path}")

def main():
    # Get all files containing (table) => ({
    result = subprocess.run(['grep', '-rl', '(table) => ({', 'src/'], capture_output=True, text=True)
    files = result.stdout.strip().split('\n')
    
    for file in files:
        if not file: continue
        fix_broken_schema(file)

if __name__ == "__main__":
    main()
