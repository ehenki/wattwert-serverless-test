# How can we include labelling using e.g. X-AnyLabeling?

- Label files are saved in .json format in the same directory as the images by default. 
If we want to label from the frontend, we have to be able to transform our database entries for windows, doors, etc. into such label files automatically with the corresponding images and then train our model on them.

{
  "version": "${version}", // X-AnyLabeling version
  "flags": {},             // Image-level flags (if any)
  "shapes": [              // List of annotated shapes
    {
      "label": "${label}",        // Category label
      "score": null,            // Confidence score (e.g., from model), null if N/A
      "points": [...],          // List of [x, y] coordinates defining the shape
      "group_id": null,         // ID for grouping related shapes (e.g., pose keypoints)
      "description": null,      // Optional text description for the shape
      "difficult": false,       // Flag if the object is difficult to identify
      "shape_type": "${shape_type}", // e.g., "rectangle", "polygon"
      "flags": null,            // Shape-level flags (if any)
      "attributes": {}          // Dictionary of custom attributes
    }
    // ... more shapes
  ],
  "description": null,      // Optional text description for the image
  "chat_history": [         // Chat history (for chatbot)
    {
      "role": "user",
      "content": "Hi",
      "image": null
    },
    {
      "role": "assistant",
      "content": "Hi there! How can I help you today?",
      "image": null
    }
    // ... more dialogs
  ],
  "vqaData": {
    "question": "What animals are shown in the image?",
    "answer": "zebras",
    "split": "train",
    "task": "QA",
    "tags": [
      "natural"
    ],
    // ... more items
  },
  "imagePath": "${filename}", // Relative path to the image file
  "imageData": null,         // Base64 encoded image data (if enabled, see 1.5)
  "imageHeight": -1,         // Image height in pixels
  "imageWidth": -1           // Image width in pixels
}


In X-AnyLabeling, each distinct annotated object is called a shape. Key properties stored for each shape include:
### `shapes` Object Schema
Each object in the `shapes` array follows this schema:

| Field | Type | Description |
|---|---|---|
| label | String | Category label of the object. |
| score | Float | Confidence score (often from AI model inference). null if not available. |
| points | Array | List of [x, y] coordinates defining the shape vertices. |
| group_id | Integer | ID to group multiple related shapes (e.g., keypoints for a pose). null if not grouped. |
| description | String | Optional text description for the shape. |
| difficult | Boolean | Flags the object as difficult to identify (true if difficult). |
| shape_type | String | Type of shape, e.g., "rectangle", "polygon". |
| flags | Dictionary | Dictionary for additional flags or attributes. null if none. |
| attributes | Dictionary | Dictionary for custom object attributes. Empty {} if none. |
| kie_linking | List | Information linking shapes (e.g., for Key Info Extraction). Empty [] if none. |


Import/export unterstützt folgende Fomrate:

    4.1 YOLO Format
    4.2 VOC Format
    4.3 COCO Format - könnten wir e.g. auch benutzen, json-basiert
    4.4 DOTA Format
    4.5 Mask Format
    4.6 MOT Format
    4.7 PPOCR Format
    4.8 ODVG Format
    4.9 VLM-R1-OVD Format
    4.10 MMGD Format


### Docs of X-AnyLabeling: https://github.com/CVHub520/X-AnyLabeling/blob/main/docs/en/user_guide.md