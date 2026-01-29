import torch.nn as nn
import torch.nn.functional as F
from torchvision.models.segmentation import deeplabv3_resnet101, DeepLabV3_ResNet101_Weights

class MultiTaskDeepLabV3Plus(nn.Module):
    def __init__(self, num_classes_elements=10, num_classes_materials=8, load_pretrained_encoder=False):
        super(MultiTaskDeepLabV3Plus, self).__init__()

        # Use the flag to decide whether to load pretrained weights
        encoder_weights = DeepLabV3_ResNet101_Weights.DEFAULT if load_pretrained_encoder else None
        self.encoder = deeplabv3_resnet101(weights=encoder_weights)
        
        self.encoder.classifier = None
        self.backbone = self.encoder.backbone

        self.element_decoder = nn.Sequential(
            nn.Conv2d(2048, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, num_classes_elements, kernel_size=1)
        )
        
        self.material_decoder = nn.Sequential(
            nn.Conv2d(2048, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, num_classes_materials, kernel_size=1)
        )

        self.aux_element_head = nn.Conv2d(2048, num_classes_elements, kernel_size=1)
        self.aux_material_head = nn.Conv2d(2048, num_classes_materials, kernel_size=1)

    def forward(self, x, task_indices=None):
        """
        Forward pass.
        - If task_indices is provided (training/eval), it processes batches based on their index.
        - If task_indices is None (single image inference), it computes both heads efficiently.
        """
        _, _, H, W = x.shape
        features = self.backbone(x)["out"]

        element_output, material_output = None, None
        aux_element_output, aux_material_output = None, None

        # Inference mode for a single image (or a batch for both tasks)
        if task_indices is None:
            element_output = F.interpolate(self.element_decoder(features), size=(H, W), mode='bilinear', align_corners=True)
            material_output = F.interpolate(self.material_decoder(features), size=(H, W), mode='bilinear', align_corners=True)
            # Aux heads are not needed for inference, so we return None for them
            return element_output, material_output, None, None

        # Training/Evaluation mode with mixed batches
        if (task_indices == 0).any():
            element_mask = task_indices == 0
            element_features = features[element_mask]
            element_output = self.element_decoder(element_features)
            element_output = F.interpolate(element_output, size=(H, W), mode='bilinear', align_corners=True)
            aux_element_output = self.aux_element_head(element_features)
            aux_element_output = F.interpolate(aux_element_output, size=(H, W), mode='bilinear', align_corners=True)

        if (task_indices == 1).any():
            material_mask = task_indices == 1
            material_features = features[material_mask]
            material_output = self.material_decoder(material_features)
            material_output = F.interpolate(material_output, size=(H, W), mode='bilinear', align_corners=True)
            aux_material_output = self.aux_material_head(material_features)
            aux_material_output = F.interpolate(aux_material_output, size=(H, W), mode='bilinear', align_corners=True)

        return element_output, material_output, aux_element_output, aux_material_output