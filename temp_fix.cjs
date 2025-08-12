const fs = require('fs');
const filePath = 'apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard.tsx';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/(\s+)\)\)\}(\s+)<\/div>/g, '$1))}; $2</div>');
fs.writeFileSync(filePath, content);
