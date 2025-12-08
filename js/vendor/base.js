var JCGWeb = JCGWeb || {};
JCGWeb.Variables = JCGWeb.Variables || {};
JCGWeb.Variables.Mouse = JCGWeb.Variables.Mouse || {};

document.addEventListener('mousemove', (event) => {
	JCGWeb.Variables.Mouse.X = event.clientX;
	JCGWeb.Variables.Mouse.Y = event.clientY;
});


JCGWeb.Functions = {};
JCGWeb.Functions.toObeserverGetMousePos = (event) => {
	if(typeof event?.screenX != 'number')
		return;
	JCGWeb.Variables.Mouse.X = event.screenX;
	JCGWeb.Variables.Mouse.Y = event.screenY;	
}

JCGWeb.Functions.MakeSafePos = (width, height, left, top, parent = document.body) => {
	width = parseFloat(width);
	height = parseFloat(height);
	left = parseFloat(left);
	top = parseFloat(top);
	let parentInfo = JCGWeb.Functions.GetElementDimensions(parent);
	if (left + width > parentInfo.width)
		left = parentInfo.width - width;
	if (top + height > parentInfo.height)
		top = parentInfo.height - height;
	if (left < 0)
		left = 0;
	if (top < 0)
		top = 0;
	return {
		left,
		top
	}
}

JCGWeb.Functions.Parser = new DOMParser();

JCGWeb.Functions.CreateElementFromHTML = (htmlString) => {
	return JCGWeb.Functions.Parser.parseFromString(htmlString, 'text/html').body.children;
}

JCGWeb.Functions.FindComponentFromEvent = (event, LookFor, ValueToLook) => {
	var el = event.target;
	switch (LookFor) {
		case 'class':
			while(!!el && el.className != ValueToLook && el.tagName != 'BODY') {
				el = el.parentElement;
			}
			break;
		case 'id':
			while(!!el && el.id != ValueToLook && el.tagName != 'BODY') {
				el = el.parentElement;
			}
			break;
		case 'tag':
			while(!!el && el.tagName != ValueToLook && el.tagName != 'BODY') {
				el = el.parentElement;
			}
			break;
		case 'attr':
			while(!!el && el.getAttribute(ValueToLook) == null && el.tagName != 'BODY') {
				el = el.parentElement;
			}
			break;
		case 'attr-value':
			while(!!el && el.getAttribute(ValueToLook[0]) != ValueToLook[1] && el.tagName != 'BODY') {
				el = el.parentElement;
			}
			break;			
		default:
			break;
	}
	return el;
}

JCGWeb.Functions.getUniqueSelector = element => {
  function findIndexOnParent(parent, child) {
    if (!parent || !child) return -1; // Invalid input
    if (parent.children.length === 0) return -1; // No children
    if (parent.children.length === 1) return -1; // Only one child, no need for nth-child
    return Array.from(parent.children).indexOf(child);
  }

  if (!element) return '';
  if (element.id) return `#${element.id}`;

  let selector = '';
  const path = [];
  
  while (element) {
    const tag = element.tagName.toLowerCase();
    let currentSelector = tag;
    
    // Add class names if they exist
    if (element.classList.length > 0) {
      const classNames = Array.from(element.classList).filter(name => name.trim() !== '');
      if (classNames.length > 0) {
        currentSelector += `.${classNames.join('.')}`;
      }
    }
    
    // For elements with parent, add their position among siblings
    if (element.parentElement) {
      const index = findIndexOnParent(element.parentElement, element);
      if (index !== -1) {
        currentSelector += `:nth-child(${index + 1})`;
      }
    }
    
    path.unshift(currentSelector);
    element = element.parentElement;
  }

  selector = path.join(' > ');
  return selector;
}

JCGWeb.Functions.getUniqueSelectorOnClick = () => {
  this.page = document.querySelector('html');
  this.page.addEventListener('click', (e) => {
    const selector = JCGWeb.Functions.getUniqueSelector(e.target);
    if (selector) {
      this.page.setAttribute('data-clicked-selector', selector);
    }
  });
}

JCGWeb.Functions.GetElementDimensions = element => {
	if (element === document.body || element === document.documentElement) {
		return {
			width: window.innerWidth,
			height: window.innerHeight,
			top: 0,
			left: 0
		};
	}
	const rect = element.getBoundingClientRect();
	return {
		width: rect.width,
		height: rect.height,
		top: rect.top + window.scrollY,
		left: rect.left + window.scrollX
	};
}

function OnPageLoad() {
	JCGWeb.Observer = new Observer(document.body);
  JCGWeb.Observer.AddCallBack(JCGWeb.Functions.toObeserverGetMousePos);
  JCGWeb.Observer.Start();

	//CreatePopup('What is Lorem Ipsum?', `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.`, true, 'OK', ((e) => {console.log(e)}), 'CANCELAR') 
}

document.addEventListener('DOMContentLoaded', OnPageLoad)




